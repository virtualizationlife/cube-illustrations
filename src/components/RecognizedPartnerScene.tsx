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

const GRID_CELL_SIZE = 0.047
const PARTNER_ID = 'recognized-partner'
const OTHER_ID = 'recognized-other'
const PARTNER_START: GridCoordinate = { column: -7, row: 0 }
const OTHER_START: GridCoordinate = { column: 7, row: 0 }
const MEMORY_POSITIONS: readonly GridCoordinate[] = [
    { column: -1, row: 0 },
    { column: 0, row: 1 },
    { column: 1, row: 1 },
    { column: 1, row: 0 },
]
const MEMORY_IDS = MEMORY_POSITIONS.map((_, index) => `recognized-memory-${index}`)
const BACKGROUND_POSITIONS: readonly GridCoordinate[] = [
    { column: -5, row: -5 },
    { column: -3, row: 5 },
    { column: 3, row: -5 },
    { column: 5, row: 5 },
]

interface RecognizedPartnerController {
    readonly presentation: ScenePresentationController
    readonly dispose: () => void
}

interface PairedStep {
    readonly main: GridCoordinate
    readonly partner: GridCoordinate
}

const FIRST_ROUTINE: readonly PairedStep[] = [
    { main: { column: 0, row: 1 }, partner: { column: 0, row: 0 } },
    { main: { column: 1, row: 1 }, partner: { column: 0, row: 1 } },
    { main: { column: 1, row: 0 }, partner: { column: 1, row: 1 } },
    { main: { column: 0, row: 0 }, partner: { column: 1, row: 0 } },
]

const SECOND_ROUTINE: readonly PairedStep[] = [
    { main: { column: 1, row: 1 }, partner: { column: 1, row: 0 } },
    { main: { column: 2, row: 1 }, partner: { column: 1, row: 1 } },
    { main: { column: 2, row: 0 }, partner: { column: 2, row: 1 } },
    { main: { column: 1, row: 0 }, partner: { column: 2, row: 0 } },
]

const createRecognizedPartnerAnimation = (
    runtime: GridSceneRuntime
): RecognizedPartnerController => {
    let cancelled = false
    const delay = createCancellableDelay()
    const presentation = createScenePresentation({
        zoom: 1,
        gridOpacity: 0.5,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 10,
    })

    const move = (cubeId: string, position: GridCoordinate, duration = 0.44): Promise<void> =>
        runtime.moveCubeTo(cubeId, position, {
            duration,
            easing: 'easeInOutCubic',
        })

    const setStart = (): void => {
        runtime.setCubePosition(MAIN_CUBE_ID, { column: 0, row: 0 })
        runtime.setCubePosition(PARTNER_ID, PARTNER_START)
        runtime.setCubePosition(OTHER_ID, OTHER_START)
    }

    const fadeMemories = (opacity: number, duration: number): Promise<void[]> =>
        Promise.all(
            MEMORY_IDS.map((id) =>
                runtime.fadeCubeTo(id, opacity, {
                    duration,
                    easing: 'easeOutCubic',
                })
            )
        )

    const playRoutine = async (
        steps: readonly PairedStep[],
        writeMemory: boolean
    ): Promise<void> => {
        for (let index = 0; index < steps.length; index += 1) {
            const step = steps[index]
            if (step === undefined) continue
            await move(MAIN_CUBE_ID, step.main)
            if (cancelled) return
            await move(PARTNER_ID, step.partner)
            if (cancelled) return
            if (writeMemory) {
                const memoryId = MEMORY_IDS[index]
                if (memoryId !== undefined) {
                    await runtime.fadeCubeTo(memoryId, 0.16, {
                        duration: 0.22,
                        easing: 'easeOutCubic',
                    })
                }
            }
            await delay.wait(0.12)
        }
    }

    const swapVisitors = async (): Promise<void> => {
        await Promise.all([
            move(PARTNER_ID, { column: 0, row: -4 }, 0.72),
            move(OTHER_ID, { column: 0, row: 4 }, 0.72),
        ])
        if (cancelled) return
        await Promise.all([
            move(PARTNER_ID, { column: 7, row: 0 }, 0.9),
            move(OTHER_ID, { column: -7, row: 0 }, 0.9),
        ])
    }

    const reset = async (): Promise<void> => {
        await Promise.all([
            runtime.fadeCubeTo(MAIN_CUBE_ID, 0, { duration: 0.36, easing: 'linear' }),
            runtime.fadeCubeTo(PARTNER_ID, 0, { duration: 0.36, easing: 'linear' }),
            runtime.fadeCubeTo(OTHER_ID, 0, { duration: 0.36, easing: 'linear' }),
            fadeMemories(0, 0.36),
        ])
        if (cancelled) return
        setStart()
        presentation.setTarget({ zoom: 1, gridOpacity: 0.5 })
        await Promise.all([
            runtime.fadeCubeTo(MAIN_CUBE_ID, 1, {
                duration: 0.4,
                easing: 'easeOutCubic',
            }),
            runtime.fadeCubeTo(PARTNER_ID, 1, {
                duration: 0.4,
                easing: 'easeOutCubic',
            }),
            runtime.fadeCubeTo(OTHER_ID, 1, {
                duration: 0.4,
                easing: 'easeOutCubic',
            }),
        ])
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.9)
        while (!cancelled) {
            await move(PARTNER_ID, { column: -1, row: 0 }, 0.9)
            if (cancelled) return
            await delay.wait(0.45)
            await playRoutine(FIRST_ROUTINE, true)
            if (cancelled) return
            await move(PARTNER_ID, { column: -5, row: 0 }, 0.76)
            if (cancelled) return
            await delay.wait(0.5)

            await swapVisitors()
            if (cancelled) return
            await delay.wait(0.7)
            await Promise.all([
                move(PARTNER_ID, { column: 2, row: 0 }, 0.78),
                move(OTHER_ID, { column: -2, row: 0 }, 0.78),
            ])
            if (cancelled) return
            presentation.setTarget({ zoom: 1.2, gridOpacity: 0.66 })
            await fadeMemories(0.42, 0.42)
            if (cancelled) return
            await move(MAIN_CUBE_ID, { column: 1, row: 0 }, 0.46)
            if (cancelled) return
            await playRoutine(SECOND_ROUTINE, false)
            if (cancelled) return
            await fadeMemories(0.18, 0.36)
            await delay.wait(1.3)
            if (cancelled) return
            await reset()
            await delay.wait(0.65)
        }
    }

    void startSceneAnimation('Recognized Partner', play)
    return {
        presentation,
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

const addCube = (
    runtime: GridSceneRuntime,
    id: string,
    position: GridCoordinate,
    faceLabels: GridCubeFaceLabelInput | undefined
): void => {
    runtime.addCube({ id, position, faceLabels })
}

/** A cube recognizes its previous partner after two identical visitors exchange places. */
export const RecognizedPartnerScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const controllerRef = useRef<RecognizedPartnerController | null>(null)

    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            runtime.setCubePosition(MAIN_CUBE_ID, { column: 0, row: 0 })
            addCube(runtime, PARTNER_ID, PARTNER_START, faceLabels)
            addCube(runtime, OTHER_ID, OTHER_START, faceLabels)
            BACKGROUND_POSITIONS.forEach((position, index) => {
                addCube(runtime, `recognized-background-${index}`, position, faceLabels)
            })
            MEMORY_POSITIONS.forEach((position, index) => {
                const id = MEMORY_IDS[index]
                if (id === undefined) return
                runtime.addCube({
                    id,
                    position,
                    opacity: 0,
                    hoverCells: 0.04,
                    occupiesCell: false,
                    faceLabels,
                })
            })

            const controller = createRecognizedPartnerAnimation(runtime)
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
        gridCellCount: 21,
        gridOpacity: 0.5,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 10,
        cameraAzimuthDeg: 25,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
