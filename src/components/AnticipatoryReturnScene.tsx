import { useCallback, useRef, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps, GridCubeFaceLabelInput } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
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

const GRID_CELL_SIZE = 0.043
const ORIGIN: GridCoordinate = { column: 0, row: 0 }
const ENERGY_FULL_OPACITY = 0.68
const ENERGY_IDS = Array.from({ length: 5 }, (_, index) => `return-energy-${index}`)
const ENERGY_COLUMN_OFFSETS = [2, 3, 4, 5, 6] as const
const FAILURE_ECHO_ID = 'return-failure-echo'
const DOCK_POSITIONS: readonly GridCoordinate[] = [
    { column: -1, row: 0 },
    { column: 1, row: 0 },
    { column: -1, row: 1 },
    { column: 0, row: 1 },
    { column: 1, row: 1 },
]
const TERRAIN_POSITIONS: readonly GridCoordinate[] = [
    { column: 2, row: -5 },
    { column: 2, row: -6 },
    { column: -3, row: -6 },
    { column: -3, row: -8 },
    { column: 1, row: -9 },
]
const OUTBOUND_ROUTE: readonly GridCoordinate[] = [
    { column: 0, row: -2 },
    { column: 1, row: -4 },
    { column: 3, row: -6 },
    { column: 4, row: -8 },
    { column: 4, row: -10 },
]
const LATE_RETURN_ROUTE: readonly GridCoordinate[] = [
    { column: 3, row: -8 },
    { column: 1, row: -6 },
    { column: 0, row: -4 },
    { column: 0, row: -2 },
]
const EARLY_RETURN_ROUTE: readonly GridCoordinate[] = [
    { column: 1, row: -4 },
    { column: 0, row: -2 },
    ORIGIN,
]

interface AnticipatoryReturnController {
    readonly presentation: ScenePresentationController
    readonly dispose: () => void
}

const getEnergyPosition = (bodyPosition: GridCoordinate, index: number): GridCoordinate => ({
    column: bodyPosition.column + (ENERGY_COLUMN_OFFSETS[index] ?? 0),
    row: bodyPosition.row,
})

const createAnticipatoryReturnAnimation = (
    runtime: GridSceneRuntime
): AnticipatoryReturnController => {
    let cancelled = false
    const delay = createCancellableDelay()
    const presentation = createScenePresentation({
        zoom: 1.04,
        gridOpacity: 0.52,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 11,
    })

    const setEnergyPositions = (bodyPosition: GridCoordinate): void => {
        ENERGY_IDS.forEach((id, index) => {
            runtime.setCubePosition(id, getEnergyPosition(bodyPosition, index))
        })
    }

    const travelBody = async (position: GridCoordinate, duration = 0.72): Promise<void> => {
        await Promise.all([
            runtime.travelWithCube(MAIN_CUBE_ID, position, {
                duration,
                easing: 'easeInOutCubic',
            }),
            ...ENERGY_IDS.map((id, index) =>
                runtime.moveCubeTo(id, getEnergyPosition(position, index), {
                    duration,
                    easing: 'easeInOutCubic',
                })
            ),
        ])
    }

    const spendEnergy = (index: number): Promise<void> => {
        const id = ENERGY_IDS[ENERGY_IDS.length - 1 - index]
        return id === undefined
            ? Promise.resolve()
            : runtime.fadeCubeTo(id, 0, {
                  duration: 0.42,
                  easing: 'linear',
              })
    }

    const recharge = async (): Promise<void> => {
        for (const id of ENERGY_IDS) {
            await runtime.fadeCubeTo(id, ENERGY_FULL_OPACITY, {
                duration: 0.24,
                easing: 'easeOutCubic',
            })
            if (cancelled) return
            await delay.wait(0.08)
        }
    }

    const prepareAtDock = async (): Promise<void> => {
        await Promise.all([
            runtime.fadeCubeTo(MAIN_CUBE_ID, 0, { duration: 0.36, easing: 'linear' }),
            ...ENERGY_IDS.map((id) =>
                runtime.fadeCubeTo(id, 0, { duration: 0.36, easing: 'linear' })
            ),
        ])
        if (cancelled) return
        runtime.setCubePosition(MAIN_CUBE_ID, ORIGIN)
        setEnergyPositions(ORIGIN)
        await runtime.moveGridFocusTo(ORIGIN, {
            duration: 0.82,
            easing: 'easeInOutCubic',
        })
        if (cancelled) return
        presentation.setTarget({ zoom: 1.04, gridOpacity: 0.52 })
        await runtime.fadeCubeTo(MAIN_CUBE_ID, 1, {
            duration: 0.38,
            easing: 'easeOutCubic',
        })
        await recharge()
        await delay.wait(0.55)
    }

    const runLateReturn = async (): Promise<void> => {
        for (let index = 0; index < OUTBOUND_ROUTE.length; index += 1) {
            const position = OUTBOUND_ROUTE[index]
            if (position === undefined) continue
            await travelBody(position)
            if (cancelled) return
            await spendEnergy(index)
            await delay.wait(0.16)
        }
        if (cancelled) return
        presentation.setTarget({ zoom: 1.18, gridOpacity: 0.68 })
        await delay.wait(0.65)

        for (const position of LATE_RETURN_ROUTE) {
            await travelBody(position, 0.64)
            if (cancelled) return
        }
        await runtime.fadeCubeTo(MAIN_CUBE_ID, 0.42, {
            duration: 0.45,
            easing: 'linear',
        })
        await runtime.fadeCubeTo(FAILURE_ECHO_ID, 0.2, {
            duration: 0.42,
            easing: 'easeOutCubic',
        })
        await delay.wait(1.2)
    }

    const runEarlyReturn = async (): Promise<void> => {
        const earlyOutbound = OUTBOUND_ROUTE.slice(0, 3)
        for (let index = 0; index < earlyOutbound.length; index += 1) {
            const position = earlyOutbound[index]
            if (position === undefined) continue
            await travelBody(position)
            if (cancelled) return
            await spendEnergy(index)
            await delay.wait(0.16)
        }
        if (cancelled) return
        presentation.setTarget({ zoom: 1.2, gridOpacity: 0.7 })
        await delay.wait(0.72)

        for (const position of EARLY_RETURN_ROUTE) {
            await travelBody(position, 0.66)
            if (cancelled) return
        }
        await runtime.fadeCubeTo(FAILURE_ECHO_ID, 0, {
            duration: 0.46,
            easing: 'linear',
        })
        presentation.setTarget({ zoom: 1.04, gridOpacity: 0.52 })
        await recharge()
        await delay.wait(1.4)
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.9)
        while (!cancelled) {
            await runLateReturn()
            if (cancelled) return
            await prepareAtDock()
            if (cancelled) return
            await runEarlyReturn()
            if (cancelled) return
            await prepareAtDock()
        }
    }

    void startSceneAnimation('Anticipatory Return', play)
    return {
        presentation,
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

const addWorldCube = (
    runtime: GridSceneRuntime,
    id: string,
    position: GridCoordinate,
    faceLabels: GridCubeFaceLabelInput | undefined
): void => {
    runtime.addCube({ id, position, faceLabels })
}

/** A body learns to turn back before its remaining energy can no longer reach home. */
export const AnticipatoryReturnScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const controllerRef = useRef<AnticipatoryReturnController | null>(null)

    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            runtime.setCubePosition(MAIN_CUBE_ID, ORIGIN)
            DOCK_POSITIONS.forEach((position, index) => {
                addWorldCube(runtime, `return-dock-${index}`, position, faceLabels)
            })
            TERRAIN_POSITIONS.forEach((position, index) => {
                addWorldCube(runtime, `return-terrain-${index}`, position, faceLabels)
            })
            ENERGY_IDS.forEach((id, index) => {
                runtime.addCube({
                    id,
                    position: getEnergyPosition(ORIGIN, index),
                    opacity: ENERGY_FULL_OPACITY,
                    hoverCells: 0,
                    occupiesCell: false,
                    faceLabels,
                })
            })
            runtime.addCube({
                id: FAILURE_ECHO_ID,
                position: { column: 0, row: -2 },
                opacity: 0,
                hoverCells: 0.04,
                occupiesCell: false,
                faceLabels,
            })

            const controller = createAnticipatoryReturnAnimation(runtime)
            controllerRef.current = controller
            return () => {
                controller.dispose()
                if (controllerRef.current === controller) controllerRef.current = null
            }
        },
        [faceLabels]
    )

    const onFrame = useCallback(({ delta, camera, runtime }: SimpleCubeFrameContext): void => {
        controllerRef.current?.presentation.update(delta, camera, runtime)
    }, [])

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 25,
        gridOpacity: 0.52,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 11,
        cameraAzimuthDeg: 40,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
