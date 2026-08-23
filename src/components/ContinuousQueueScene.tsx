import { useCallback, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
import {
    useSimpleCubeScene,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.045
const GRID_CELL_COUNT = 15
const QUEUE_COLUMN = 0
const QUEUE_TAIL_ROW = -4
const QUEUE_HEAD_EXIT_ROW = 8
const QUEUE_SPACING_CELLS = 2
const QUEUE_MOVE_DURATION_S = 0.42
const QUEUE_MOVE_PAUSE_S = 0.035
const NEW_CUBE_MOVE_DURATION_S = 0.85
const CYCLE_PAUSE_S = 0.4

const QUEUE_CUBE_IDS = [
    MAIN_CUBE_ID,
    'queue-cube-1',
    'queue-cube-2',
    'queue-cube-3',
    'queue-cube-4',
    'queue-cube-5',
] as const

interface QueueAnimationController {
    readonly dispose: () => void
}

const getInitialQueuePosition = (index: number): GridCoordinate => ({
    column: QUEUE_COLUMN,
    row: QUEUE_HEAD_EXIT_ROW - QUEUE_SPACING_CELLS - index * QUEUE_SPACING_CELLS,
})

const createQueueAnimation = (
    runtime: GridSceneRuntime,
    cubeIds: readonly string[]
): QueueAnimationController => {
    let cancelled = false
    const delay = createCancellableDelay()
    const queue = [...cubeIds]

    const moveForward = async (cubeId: string, fadeOut: boolean): Promise<void> => {
        const source = runtime.getCubePosition(cubeId)
        if (source === undefined) return
        const destination = {
            column: source.column,
            row: source.row + QUEUE_SPACING_CELLS,
        }
        const movement = runtime.moveCubeTo(cubeId, destination, {
            duration: QUEUE_MOVE_DURATION_S,
            easing: 'easeInOutCubic',
        })
        if (fadeOut) {
            await Promise.all([
                movement,
                runtime.fadeCubeTo(cubeId, 0, {
                    duration: QUEUE_MOVE_DURATION_S,
                    easing: 'easeInOutCubic',
                }),
            ])
        } else {
            await movement
        }
    }

    const bringCubeToTail = async (cubeId: string): Promise<void> => {
        const approachFromRight = Math.random() >= 0.5
        runtime.setCubePosition(cubeId, {
            column: approachFromRight ? 6 : -6,
            row: QUEUE_TAIL_ROW,
        })
        runtime.setCubeOpacity(cubeId, 0)
        await Promise.all([
            runtime.moveCubeTo(
                cubeId,
                { column: QUEUE_COLUMN, row: QUEUE_TAIL_ROW },
                { duration: NEW_CUBE_MOVE_DURATION_S, easing: 'easeInOutCubic' }
            ),
            runtime.fadeCubeTo(cubeId, 1, {
                duration: NEW_CUBE_MOVE_DURATION_S * 0.7,
                easing: 'easeOutCubic',
            }),
        ])
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.8)
        while (!cancelled) {
            const departingCubeId = queue[0]
            if (departingCubeId === undefined) return

            await moveForward(departingCubeId, true)
            if (cancelled) return

            for (let index = 1; index < queue.length; index += 1) {
                const cubeId = queue[index]
                if (cubeId === undefined) continue
                await moveForward(cubeId, false)
                if (cancelled) return
                await delay.wait(QUEUE_MOVE_PAUSE_S)
            }

            await bringCubeToTail(departingCubeId)
            queue.shift()
            queue.push(departingCubeId)
            if (!cancelled) await delay.wait(CYCLE_PAUSE_S)
        }
    }

    void play()
    return {
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** A continuous, evenly spaced queue advances out of frame and accepts a new cube. */
export const ContinuousQueueScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            for (let index = 0; index < QUEUE_CUBE_IDS.length; index += 1) {
                const cubeId = QUEUE_CUBE_IDS[index]
                if (cubeId === undefined) continue
                const position = getInitialQueuePosition(index)
                if (cubeId === MAIN_CUBE_ID) runtime.setCubePosition(cubeId, position)
                else runtime.addCube({ id: cubeId, position, faceLabels })
            }

            const animation = createQueueAnimation(runtime, QUEUE_CUBE_IDS)
            return () => animation.dispose()
        },
        [faceLabels]
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: GRID_CELL_COUNT,
        gridFadeInnerRadiusCells: 4.5,
        gridFadeOuterRadiusCells: 8,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame: () => undefined,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
