import { useCallback, useRef, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
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

const GRID_CELL_SIZE = 0.07
const RHYTHM_CUBE_ID = 'learned-rhythm-cube'
const MAIN_ENTRY: GridCoordinate = { column: -5, row: 0 }
const MAIN_START: GridCoordinate = { column: -4, row: 0 }
const MAIN_WAIT: GridCoordinate = { column: -1, row: 0 }
const MAIN_EXIT: GridCoordinate = { column: 5, row: 0 }
const RHYTHM_ENTRY: GridCoordinate = { column: 0, row: -5 }
const RHYTHM_START: GridCoordinate = { column: 0, row: -4 }
const RHYTHM_CENTER: GridCoordinate = { column: 0, row: 0 }
const RHYTHM_END: GridCoordinate = { column: 0, row: 4 }
const RHYTHM_EXIT: GridCoordinate = { column: 0, row: 5 }

interface LearnedRhythmController {
    readonly presentation: ScenePresentationController
    readonly dispose: () => void
}

const createLearnedRhythmAnimation = (runtime: GridSceneRuntime): LearnedRhythmController => {
    let cancelled = false
    let observedPassCount = 2
    const delay = createCancellableDelay()
    const presentation = createScenePresentation({
        zoom: 1,
        gridOpacity: 0.58,
        gridFadeInnerRadiusCells: 2,
        gridFadeOuterRadiusCells: 8,
    })

    const enterCube = async (
        cubeId: string,
        entry: GridCoordinate,
        visiblePosition: GridCoordinate
    ): Promise<void> => {
        runtime.setCubePosition(cubeId, entry)
        runtime.setCubeOpacity(cubeId, 0)
        await Promise.all([
            runtime.moveCubeTo(cubeId, visiblePosition, {
                duration: 0.34,
                easing: 'easeInOutCubic',
            }),
            runtime.fadeCubeTo(cubeId, 1, {
                duration: 0.34,
                easing: 'easeOutCubic',
            }),
        ])
    }

    const exitCube = async (cubeId: string, exit: GridCoordinate): Promise<void> => {
        await Promise.all([
            runtime.moveCubeTo(cubeId, exit, {
                duration: 0.34,
                easing: 'easeInOutCubic',
            }),
            runtime.fadeCubeTo(cubeId, 0, {
                duration: 0.34,
                easing: 'easeOutCubic',
            }),
        ])
    }

    const rhythmPass = async (): Promise<void> => {
        await enterCube(RHYTHM_CUBE_ID, RHYTHM_ENTRY, RHYTHM_START)
        await runtime.moveCubeTo(RHYTHM_CUBE_ID, RHYTHM_END, {
            duration: 0.72,
            easing: 'easeInOutCubic',
        })
        await exitCube(RHYTHM_CUBE_ID, RHYTHM_EXIT)
    }

    const showConflict = async (): Promise<void> => {
        presentation.setTarget({
            zoom: 1.22,
            gridOpacity: 0.72,
            gridFadeInnerRadiusCells: 1.5,
            gridFadeOuterRadiusCells: 8,
        })
        await Promise.all([
            enterCube(MAIN_CUBE_ID, MAIN_ENTRY, MAIN_START),
            enterCube(RHYTHM_CUBE_ID, RHYTHM_ENTRY, RHYTHM_START),
        ])
        await Promise.all([
            runtime.moveCubeTo(MAIN_CUBE_ID, MAIN_WAIT, {
                duration: 0.52,
                easing: 'easeInOutCubic',
            }),
            runtime.moveCubeTo(RHYTHM_CUBE_ID, RHYTHM_CENTER, {
                duration: 0.52,
                easing: 'easeInOutCubic',
            }),
        ])
        await delay.wait(0.7)
        await runtime.moveCubeTo(RHYTHM_CUBE_ID, RHYTHM_END, {
            duration: 0.42,
            easing: 'easeInOutCubic',
        })
        await exitCube(RHYTHM_CUBE_ID, RHYTHM_EXIT)
        await runtime.moveCubeTo(MAIN_CUBE_ID, { column: 4, row: 0 }, {
            duration: 0.72,
            easing: 'easeInOutCubic',
        })
        await exitCube(MAIN_CUBE_ID, MAIN_EXIT)
    }

    const showLearnedTiming = async (): Promise<void> => {
        presentation.setTarget({
            zoom: 0.9,
            gridOpacity: 0.48,
            gridFadeInnerRadiusCells: 2.5,
            gridFadeOuterRadiusCells: 8,
        })
        await enterCube(MAIN_CUBE_ID, MAIN_ENTRY, MAIN_START)
        for (let pass = 0; pass < observedPassCount; pass += 1) {
            await rhythmPass()
            if (cancelled) return
            await delay.wait(0.16)
        }

        await delay.wait(0.55)
        presentation.setTarget({ zoom: 1.03, gridOpacity: 0.55 })
        await runtime.moveCubeTo(MAIN_CUBE_ID, { column: 4, row: 0 }, {
            duration: 0.8,
            easing: 'easeInOutCubic',
        })
        await exitCube(MAIN_CUBE_ID, MAIN_EXIT)
        observedPassCount = observedPassCount === 2 ? 1 : 2
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.7)
        while (!cancelled) {
            await showConflict()
            if (cancelled) return
            await delay.wait(0.55)
            await showLearnedTiming()
            if (!cancelled) await delay.wait(0.75)
        }
    }

    void startSceneAnimation('Learned Rhythm', play)
    return {
        presentation,
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** A cube learns another cube's crossing rhythm and uses the predictable pause. */
export const LearnedRhythmScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const controllerRef = useRef<LearnedRhythmController | null>(null)
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            runtime.setCubePosition(MAIN_CUBE_ID, MAIN_ENTRY)
            runtime.setCubeOpacity(MAIN_CUBE_ID, 0)
            runtime.addCube({
                id: RHYTHM_CUBE_ID,
                position: RHYTHM_ENTRY,
                opacity: 0,
                faceLabels,
            })
            const controller = createLearnedRhythmAnimation(runtime)
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
        gridCellCount: 15,
        gridOpacity: 0.58,
        gridFadeInnerRadiusCells: 2,
        gridFadeOuterRadiusCells: 8,
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
