import { useCallback, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import { MAIN_CUBE_ID, type GridSceneRuntime } from '../scenes/gridSceneRuntime'
import { startSceneAnimation } from '../scenes/startSceneAnimation'
import {
    useSimpleCubeScene,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.05
const SHADOW_CUBE_ID = 'trailing-shadow'
const WALK_ROW = 0
const SHADOW_ROW = 2
const START_COLUMN = -5
const STEP_DURATION_S = 0.34
const SHADOW_OPACITY = 0.3
const SHADOW_ALIGNED_OPACITY = 0.52

interface WalkLeg {
    readonly toColumn: number
    /** A leg that ends in a pause lets the shadow close the gap. */
    readonly pause: boolean
}

const WALK_LEGS: readonly WalkLeg[] = [
    { toColumn: 3, pause: true },
    { toColumn: -1, pause: false },
    { toColumn: 5, pause: true },
    { toColumn: START_COLUMN, pause: true },
]

interface TrailingShadowController {
    readonly dispose: () => void
}

const createTrailingShadowAnimation = (
    runtime: GridSceneRuntime
): TrailingShadowController => {
    let cancelled = false
    let column = START_COLUMN
    const delay = createCancellableDelay()

    const stepTo = async (nextColumn: number): Promise<void> => {
        const vacatedColumn = column
        column = nextColumn
        await Promise.all([
            runtime.moveCubeTo(
                MAIN_CUBE_ID,
                { column: nextColumn, row: WALK_ROW },
                { duration: STEP_DURATION_S, easing: 'easeInOutCubic' }
            ),
            // The shadow is always one step behind: it only reaches the cell the cube
            // has just left, which sends it the wrong way for a step after a reversal.
            runtime.moveCubeTo(
                SHADOW_CUBE_ID,
                { column: vacatedColumn, row: SHADOW_ROW },
                { duration: STEP_DURATION_S, easing: 'easeInOutCubic' }
            ),
        ])
    }

    const catchUp = async (): Promise<void> => {
        await Promise.all([
            runtime.moveCubeTo(
                SHADOW_CUBE_ID,
                { column, row: SHADOW_ROW },
                { duration: STEP_DURATION_S, easing: 'easeOutCubic' }
            ),
            runtime.fadeCubeTo(SHADOW_CUBE_ID, SHADOW_ALIGNED_OPACITY, {
                duration: STEP_DURATION_S,
                easing: 'easeOutCubic',
            }),
        ])
        if (cancelled) return
        await delay.wait(0.75)
        if (cancelled) return
        await runtime.fadeCubeTo(SHADOW_CUBE_ID, SHADOW_OPACITY, {
            duration: 0.3,
            easing: 'easeOutCubic',
        })
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.8)
        while (!cancelled) {
            for (const leg of WALK_LEGS) {
                const direction = leg.toColumn > column ? 1 : -1
                while (!cancelled && column !== leg.toColumn) {
                    await stepTo(column + direction)
                    if (cancelled) return
                }
                if (cancelled) return
                if (!leg.pause) continue
                await catchUp()
                if (cancelled) return
            }
        }
    }

    void startSceneAnimation('Trailing Shadow', play)
    return {
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** A translucent double lags one step behind and only squares up when the cube stops. */
export const TrailingShadowScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            runtime.setCubePosition(MAIN_CUBE_ID, {
                column: START_COLUMN,
                row: WALK_ROW,
            })
            runtime.addCube({
                id: SHADOW_CUBE_ID,
                position: { column: START_COLUMN, row: SHADOW_ROW },
                opacity: SHADOW_OPACITY,
                faceLabels,
            })
            const animation = createTrailingShadowAnimation(runtime)
            return () => animation.dispose()
        },
        [faceLabels]
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 17,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 9,
        cameraAzimuthDeg: 20,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame: () => undefined,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
