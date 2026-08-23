import { useCallback, useRef, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
import { getDifferentRandomIndex } from '../scenes/sceneRandom'
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

const GRID_CELL_SIZE = 0.045
const THRESHOLD_CUBE_ID = 'remembered-threshold'
const CORRIDOR_ROW = 0
const DETOUR_ROW = -1
const ENTRY: GridCoordinate = { column: -7, row: CORRIDOR_ROW }
const EXIT: GridCoordinate = { column: 7, row: CORRIDOR_ROW }
const VISIBLE_START: GridCoordinate = { column: -5, row: CORRIDOR_ROW }
const PARKED: GridCoordinate = { column: 0, row: -7 }
const THRESHOLD_COLUMNS = [0, 2, -2] as const
/** Hesitation before the cell, shrinking with every repetition of the useless detour. */
const REMEMBERED_HESITATIONS_S = [0.4, 0.26, 0.14] as const
const STEP_DURATION_S = 0.16

interface RememberedThresholdController {
    readonly presentation: ScenePresentationController
    readonly dispose: () => void
}

const createRememberedThresholdAnimation = (
    runtime: GridSceneRuntime
): RememberedThresholdController => {
    let cancelled = false
    let thresholdIndex = 0
    const delay = createCancellableDelay()
    const presentation = createScenePresentation({
        zoom: 1,
        gridOpacity: 0.52,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 10,
    })

    const walkTo = (position: GridCoordinate, cells: number): Promise<void> =>
        runtime.moveCubeTo(MAIN_CUBE_ID, position, {
            duration: Math.max(STEP_DURATION_S, cells * STEP_DURATION_S),
            easing: 'easeInOutCubic',
        })

    const enterCorridor = async (): Promise<void> => {
        runtime.setCubePosition(MAIN_CUBE_ID, ENTRY)
        await Promise.all([
            walkTo(VISIBLE_START, 2),
            runtime.fadeCubeTo(MAIN_CUBE_ID, 1, {
                duration: 0.36,
                easing: 'easeOutCubic',
            }),
        ])
    }

    const leaveCorridor = async (fromColumn: number): Promise<void> => {
        await Promise.all([
            walkTo(EXIT, EXIT.column - fromColumn),
            runtime.fadeCubeTo(MAIN_CUBE_ID, 0, {
                duration: 0.5,
                easing: 'easeOutCubic',
            }),
        ])
    }

    const stepAround = async (thresholdColumn: number): Promise<void> => {
        await walkTo({ column: thresholdColumn - 1, row: DETOUR_ROW }, 1)
        if (cancelled) return
        await walkTo({ column: thresholdColumn + 1, row: DETOUR_ROW }, 2)
        if (cancelled) return
        await walkTo({ column: thresholdColumn + 1, row: CORRIDOR_ROW }, 1)
    }

    const runPass = async (
        thresholdColumn: number,
        hesitation: number
    ): Promise<void> => {
        await enterCorridor()
        if (cancelled) return
        await walkTo(
            { column: thresholdColumn - 1, row: CORRIDOR_ROW },
            thresholdColumn - 1 - VISIBLE_START.column
        )
        if (cancelled) return
        await delay.wait(hesitation)
        if (cancelled) return
        await stepAround(thresholdColumn)
        if (cancelled) return
        await leaveCorridor(thresholdColumn + 1)
    }

    /** The cube finally tests the cell it has been avoiding, and the memory dissolves. */
    const runTestingPass = async (thresholdColumn: number): Promise<void> => {
        await enterCorridor()
        if (cancelled) return
        await walkTo(
            { column: thresholdColumn - 1, row: CORRIDOR_ROW },
            thresholdColumn - 1 - VISIBLE_START.column
        )
        if (cancelled) return
        presentation.setTarget({
            zoom: 1.2,
            gridOpacity: 0.72,
            gridFadeInnerRadiusCells: 2,
            gridFadeOuterRadiusCells: 10,
        })
        await delay.wait(0.95)
        if (cancelled) return
        await walkTo({ column: thresholdColumn, row: CORRIDOR_ROW }, 1)
        if (cancelled) return
        await delay.wait(0.3)
        presentation.setTarget({
            zoom: 1,
            gridOpacity: 0.52,
            gridFadeInnerRadiusCells: 3,
            gridFadeOuterRadiusCells: 10,
        })
        if (cancelled) return
        await leaveCorridor(thresholdColumn)
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.8)
        while (!cancelled) {
            const thresholdColumn = THRESHOLD_COLUMNS[thresholdIndex] ?? 0

            // A real obstacle, met once.
            runtime.setCubePosition(THRESHOLD_CUBE_ID, {
                column: thresholdColumn,
                row: CORRIDOR_ROW,
            })
            await runtime.fadeCubeTo(THRESHOLD_CUBE_ID, 1, {
                duration: 0.4,
                easing: 'easeOutCubic',
            })
            if (cancelled) return
            await runPass(thresholdColumn, 0.6)
            if (cancelled) return

            // The obstacle is gone; only the avoidance stays.
            await runtime.fadeCubeTo(THRESHOLD_CUBE_ID, 0, {
                duration: 0.5,
                easing: 'easeOutCubic',
            })
            if (cancelled) return
            runtime.setCubePosition(THRESHOLD_CUBE_ID, PARKED)

            for (const hesitation of REMEMBERED_HESITATIONS_S) {
                if (cancelled) return
                await runPass(thresholdColumn, hesitation)
            }
            if (cancelled) return
            await runTestingPass(thresholdColumn)
            if (cancelled) return

            thresholdIndex = getDifferentRandomIndex(
                THRESHOLD_COLUMNS.length,
                thresholdIndex
            )
            await delay.wait(0.5)
        }
    }

    void startSceneAnimation('Remembered Threshold', play)
    return {
        presentation,
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** A cube keeps stepping around a cell whose obstacle disappeared long ago. */
export const RememberedThresholdScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const controllerRef = useRef<RememberedThresholdController | null>(null)

    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            runtime.setCubePosition(MAIN_CUBE_ID, ENTRY)
            runtime.setCubeOpacity(MAIN_CUBE_ID, 0)
            runtime.addCube({
                id: THRESHOLD_CUBE_ID,
                position: PARKED,
                opacity: 0,
                faceLabels,
            })
            const controller = createRememberedThresholdAnimation(runtime)
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
        gridCellCount: 19,
        gridOpacity: 0.52,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 10,
        cameraAzimuthDeg: 15,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
