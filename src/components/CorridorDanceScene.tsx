import { useCallback, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
import { startSceneAnimation } from '../scenes/startSceneAnimation'
import {
    useSimpleCubeScene,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.05
const ONCOMING_CUBE_ID = 'corridor-oncoming'
const CORRIDOR_ROW = 0
const LEFT_ENTRY: GridCoordinate = { column: -7, row: CORRIDOR_ROW }
const RIGHT_ENTRY: GridCoordinate = { column: 7, row: CORRIDOR_ROW }
const LEFT_FACING_COLUMN = -1
const RIGHT_FACING_COLUMN = 1
const BYPASS_ROW = -1
/** Free cell used to swap the two entries without a moment of overlap. */
const PARKING: GridCoordinate = { column: 0, row: -4 }
/** Both step aside the same way this many times before one of them stops being polite. */
const MIRRORED_ATTEMPTS = 3
const SIDESTEP_ROWS = [-1, 1, -1] as const
const STEP_DURATION_S = 0.3

interface CorridorDanceController {
    readonly dispose: () => void
}

const createCorridorDanceAnimation = (
    runtime: GridSceneRuntime
): CorridorDanceController => {
    let cancelled = false
    const delay = createCancellableDelay()

    const moveBoth = (
        leftPosition: GridCoordinate,
        rightPosition: GridCoordinate,
        duration: number
    ): Promise<unknown> =>
        Promise.all([
            runtime.moveCubeTo(MAIN_CUBE_ID, leftPosition, {
                duration,
                easing: 'easeInOutCubic',
            }),
            runtime.moveCubeTo(ONCOMING_CUBE_ID, rightPosition, {
                duration,
                easing: 'easeInOutCubic',
            }),
        ])

    const enterCorridor = async (): Promise<void> => {
        // After a pass the two cubes hold each other's entry, so the swap needs a
        // free cell in between: no cube may ever be placed on an occupied one.
        runtime.setCubePosition(ONCOMING_CUBE_ID, PARKING)
        runtime.setCubePosition(MAIN_CUBE_ID, LEFT_ENTRY)
        runtime.setCubePosition(ONCOMING_CUBE_ID, RIGHT_ENTRY)
        await Promise.all([
            runtime.fadeCubeTo(MAIN_CUBE_ID, 1, { duration: 0.6 }),
            runtime.fadeCubeTo(ONCOMING_CUBE_ID, 1, { duration: 0.6 }),
            moveBoth(
                { column: LEFT_FACING_COLUMN, row: CORRIDOR_ROW },
                { column: RIGHT_FACING_COLUMN, row: CORRIDOR_ROW },
                1.5
            ),
        ])
    }

    /** The polite deadlock: both yield at the same moment and to the same side. */
    const mirroredSidestep = async (row: number): Promise<void> => {
        await moveBoth(
            { column: LEFT_FACING_COLUMN, row },
            { column: RIGHT_FACING_COLUMN, row },
            STEP_DURATION_S
        )
        if (cancelled) return
        await delay.wait(0.4)
        if (cancelled) return
        await moveBoth(
            { column: LEFT_FACING_COLUMN, row: CORRIDOR_ROW },
            { column: RIGHT_FACING_COLUMN, row: CORRIDOR_ROW },
            STEP_DURATION_S
        )
        if (cancelled) return
        await delay.wait(0.35)
    }

    /** One of them stops moving, which is the only thing that resolves the symmetry. */
    const resolveAndPass = async (): Promise<void> => {
        await delay.wait(0.5)
        if (cancelled) return
        await runtime.moveCubeTo(
            ONCOMING_CUBE_ID,
            { column: RIGHT_FACING_COLUMN, row: BYPASS_ROW },
            { duration: STEP_DURATION_S, easing: 'easeInOutCubic' }
        )
        if (cancelled) return
        await runtime.moveCubeTo(
            ONCOMING_CUBE_ID,
            { column: LEFT_FACING_COLUMN - 2, row: BYPASS_ROW },
            { duration: 0.75, easing: 'easeInOutCubic' }
        )
        if (cancelled) return
        await runtime.moveCubeTo(
            ONCOMING_CUBE_ID,
            { column: LEFT_FACING_COLUMN - 2, row: CORRIDOR_ROW },
            { duration: STEP_DURATION_S, easing: 'easeInOutCubic' }
        )
        if (cancelled) return
        await delay.wait(0.3)
        await Promise.all([
            runtime.fadeCubeTo(MAIN_CUBE_ID, 0, { duration: 1.1 }),
            runtime.fadeCubeTo(ONCOMING_CUBE_ID, 0, { duration: 1.1 }),
            moveBoth(RIGHT_ENTRY, LEFT_ENTRY, 1.4),
        ])
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.7)
        while (!cancelled) {
            await enterCorridor()
            if (cancelled) return
            await delay.wait(0.45)
            for (let attempt = 0; attempt < MIRRORED_ATTEMPTS; attempt += 1) {
                const row = SIDESTEP_ROWS[attempt]
                if (row === undefined || cancelled) break
                await mirroredSidestep(row)
            }
            if (cancelled) return
            await resolveAndPass()
            if (cancelled) return
            await delay.wait(0.6)
        }
    }

    void startSceneAnimation('Corridor Dance', play)
    return {
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** Two cubes yield to each other simultaneously until one of them holds still. */
export const CorridorDanceScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            runtime.setCubePosition(MAIN_CUBE_ID, LEFT_ENTRY)
            runtime.setCubeOpacity(MAIN_CUBE_ID, 0)
            runtime.addCube({
                id: ONCOMING_CUBE_ID,
                position: RIGHT_ENTRY,
                opacity: 0,
                faceLabels,
            })
            const animation = createCorridorDanceAnimation(runtime)
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
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame: () => undefined,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
