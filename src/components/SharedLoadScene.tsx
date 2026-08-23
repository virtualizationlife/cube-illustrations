import { useCallback, useRef, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type {
    CubeFaceLabelsProps,
    GridCubeFaceLabelInput,
} from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import { MAIN_CUBE_ID, type GridSceneRuntime } from '../scenes/gridSceneRuntime'
import {
    createScenePresentation,
    type ScenePresentationController,
} from '../scenes/scenePresentation'
import { startSceneAnimation } from '../scenes/startSceneAnimation'
import {
    useSimpleCubeScene,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.05
/** Every carrier that can ever be under the load; only a phase's crew exists at a time. */
const CARRIER_IDS = Array.from({ length: 5 }, (_, index) => `shared-carrier-${index}`)
const INITIAL_CREW_SIZE = 3

interface CarrierPace {
    /** Carriers that leave the line together, which is also the load's step per cycle. */
    readonly relocations: number
    readonly stepAside: number
    readonly walkAhead: number
    readonly stepIn: number
    readonly pause: number
    readonly zoom: number
}

const STEADY_PACE: CarrierPace = {
    relocations: 1,
    stepAside: 0.26,
    walkAhead: 0.74,
    stepIn: 0.26,
    pause: 0.32,
    zoom: 1.06,
}
const BRISK_PACE: CarrierPace = {
    relocations: 1,
    stepAside: 0.19,
    walkAhead: 0.48,
    stepIn: 0.19,
    pause: 0.14,
    zoom: 0.99,
}
const RUSHING_PACE: CarrierPace = {
    relocations: 2,
    stepAside: 0.16,
    walkAhead: 0.44,
    stepIn: 0.16,
    pause: 0.06,
    zoom: 0.9,
}

const getPace = (crewSize: number): CarrierPace => {
    if (crewSize >= 5) return RUSHING_PACE
    if (crewSize === 4) return BRISK_PACE
    return STEADY_PACE
}

interface CrewPhase {
    readonly crewSize: number
    readonly cycles: number
}

/** The crew grows to five and shrinks back to three, then the sequence repeats. */
const CREW_PHASES: readonly CrewPhase[] = [
    { crewSize: 3, cycles: 3 },
    { crewSize: 4, cycles: 3 },
    { crewSize: 5, cycles: 4 },
    { crewSize: 4, cycles: 3 },
]

interface SharedLoadController {
    readonly presentation: ScenePresentationController
    readonly dispose: () => void
}

const createSharedLoadAnimation = (
    runtime: GridSceneRuntime,
    faceLabels: GridCubeFaceLabelInput | undefined
): SharedLoadController => {
    let cancelled = false
    // Carriers stand on consecutive columns of row 0, ordered from the rear to the front.
    const crew: string[] = []
    // The load starts at column 0, so the first crew is built directly under it.
    let frontColumn = STEADY_PACE.relocations
    let sideSign = 1
    const delay = createCancellableDelay()
    const presentation = createScenePresentation({
        zoom: STEADY_PACE.zoom,
        gridOpacity: 0.55,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 9,
    })

    /** Alternates the lane a carrier uses so passing carriers never share one side. */
    const nextSide = (): number => {
        sideSign = -sideSign
        return sideSign
    }

    /**
     * Only the rearmost carriers step out of the line, so the load rides over the part of
     * it that never empties: as many cells behind the leader as there are carriers
     * relocating in one cycle.
     */
    const getLoadColumn = (pace: CarrierPace): number => frontColumn - pace.relocations

    const carryLoadTo = (column: number, duration: number): void => {
        void startSceneAnimation('Shared Load', () =>
            runtime.travelWithCube(
                MAIN_CUBE_ID,
                { column, row: 0 },
                { duration, easing: 'easeInOutCubic' }
            )
        )
    }

    /** Walks one carrier out of the line, past the crew, and back in at the front. */
    const relocate = async (
        carrierId: string,
        targetColumn: number,
        side: number,
        pace: CarrierPace
    ): Promise<void> => {
        const start = runtime.getCubePosition(carrierId)
        if (start === undefined) return
        await runtime.moveCubeTo(
            carrierId,
            { column: start.column, row: side },
            { duration: pace.stepAside, easing: 'easeOutCubic' }
        )
        if (cancelled) return
        await runtime.moveCubeTo(
            carrierId,
            { column: targetColumn, row: side },
            { duration: pace.walkAhead, easing: 'easeInOutCubic' }
        )
        if (cancelled) return
        await runtime.moveCubeTo(
            carrierId,
            { column: targetColumn, row: 0 },
            { duration: pace.stepIn, easing: 'easeOutCubic' }
        )
    }

    const runCarryCycle = async (pace: CarrierPace): Promise<void> => {
        const leaving = crew.splice(0, pace.relocations)
        if (leaving.length === 0) return
        const relocations = leaving.map((carrierId, index) =>
            relocate(carrierId, frontColumn + index + 1, nextSide(), pace)
        )
        frontColumn += leaving.length
        crew.push(...leaving)

        await delay.wait(pace.stepAside)
        if (cancelled) return
        carryLoadTo(getLoadColumn(pace), pace.walkAhead + pace.stepIn)
        await Promise.all(relocations)
        if (cancelled) return
        await delay.wait(pace.pause)
    }

    /** A spare carrier walks in behind the crew and takes the last place in the line. */
    const addCarrier = async (): Promise<void> => {
        const carrierId = CARRIER_IDS.find((id) => !runtime.hasCube(id))
        if (carrierId === undefined) return
        const rearColumn = frontColumn - crew.length
        const side = nextSide()
        runtime.addCube({
            id: carrierId,
            position: { column: rearColumn - 1, row: side },
            opacity: 0,
            faceLabels,
        })
        await Promise.all([
            runtime.fadeCubeTo(carrierId, 1, { duration: 0.4, easing: 'linear' }),
            runtime.moveCubeTo(
                carrierId,
                { column: rearColumn, row: side },
                { duration: 0.44, easing: 'easeOutCubic' }
            ),
        ])
        if (cancelled) return
        await runtime.moveCubeTo(
            carrierId,
            { column: rearColumn, row: 0 },
            { duration: 0.3, easing: 'easeOutCubic' }
        )
        crew.unshift(carrierId)
    }

    /** The rearmost carrier steps out of the line and stays behind. */
    const removeCarrier = async (): Promise<void> => {
        const carrierId = crew.shift()
        if (carrierId === undefined) return
        const position = runtime.getCubePosition(carrierId)
        if (position !== undefined) {
            await runtime.moveCubeTo(
                carrierId,
                { column: position.column, row: nextSide() },
                { duration: 0.32, easing: 'easeOutCubic' }
            )
        }
        await runtime.fadeCubeTo(carrierId, 0, { duration: 0.42, easing: 'linear' })
        runtime.removeCube(carrierId)
    }

    const setCrewSize = async (crewSize: number): Promise<void> => {
        while (!cancelled && crew.length < crewSize) await addCarrier()
        while (!cancelled && crew.length > crewSize) await removeCarrier()
    }

    /**
     * A shorter line carries the load closer to its leader. The load slides into its new
     * place while the crew reshapes; a longer line lets the next cycle catch up instead,
     * because the load never travels backwards.
     */
    const settleLoad = async (pace: CarrierPace): Promise<void> => {
        const target = getLoadColumn(pace)
        const current = runtime.getCubePosition(MAIN_CUBE_ID)?.column
        if (current === undefined || target <= current) return
        await runtime.travelWithCube(
            MAIN_CUBE_ID,
            { column: target, row: 0 },
            { duration: 0.52, easing: 'easeInOutCubic' }
        )
    }

    const play = async (): Promise<void> => {
        await setCrewSize(INITIAL_CREW_SIZE)
        await delay.wait(0.8)
        let phaseIndex = 0
        while (!cancelled) {
            const phase = CREW_PHASES[phaseIndex]
            if (phase === undefined) return
            phaseIndex = (phaseIndex + 1) % CREW_PHASES.length

            const pace = getPace(phase.crewSize)
            presentation.setTarget({ zoom: pace.zoom })
            await setCrewSize(phase.crewSize)
            if (cancelled) return
            await settleLoad(pace)
            if (cancelled) return
            for (let cycle = 0; cycle < phase.cycles && !cancelled; cycle += 1) {
                await runCarryCycle(pace)
            }
        }
    }

    void startSceneAnimation('Shared Load', play)
    return {
        presentation,
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** Carriers take turns under a lifted load, stepping around it to rebuild the line ahead. */
export const SharedLoadScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const controllerRef = useRef<SharedLoadController | null>(null)
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            // The load rides one cell above the grid, on the same cells as its carriers.
            runtime.setCubeOccupiesCell(MAIN_CUBE_ID, false)
            const controller = createSharedLoadAnimation(runtime, faceLabels)
            controllerRef.current = controller
            return () => {
                controller.dispose()
                if (controllerRef.current === controller) controllerRef.current = null
            }
        },
        [faceLabels]
    )
    const onFrame = useCallback(
        ({ delta, camera, runtime }: SimpleCubeFrameContext): void => {
            controllerRef.current?.presentation.update(delta, camera, runtime)
        },
        []
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 17,
        gridOpacity: 0.55,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 9,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 1,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
