import { MAIN_CUBE_ID, type GridCoordinate } from '@scenes/gridSceneRuntime'
import { GRID_PRESETS } from '@scenes/motion'
import { defineScene } from '@sdk/defineScene'

const GRID_CELL_SIZE = GRID_PRESETS.corridor.gridCellSize
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

/** Two cubes yield to each other simultaneously until one of them holds still. */
export const CorridorDanceScene = defineScene({
    metadata: {
        id: 'corridor-dance',
        title: 'Corridor Dance',
        tags: ['relation', 'symmetry'],
        description: 'Mirrored politeness deadlocks until one cube holds still.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: GRID_PRESETS.corridor.gridCellCount,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 9,
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        runtime.setCubePosition(MAIN_CUBE_ID, LEFT_ENTRY)
        runtime.setCubeOpacity(MAIN_CUBE_ID, 0)
        runtime.addCube({
            id: ONCOMING_CUBE_ID,
            position: RIGHT_ENTRY,
            opacity: 0,
            faceLabels: props.faceLabels,
        })
    },
    script: async ({ runtime, timeline }) => {
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
            await timeline.wait(0.4)
            await moveBoth(
                { column: LEFT_FACING_COLUMN, row: CORRIDOR_ROW },
                { column: RIGHT_FACING_COLUMN, row: CORRIDOR_ROW },
                STEP_DURATION_S
            )
            await timeline.wait(0.35)
        }

        /** One of them stops moving, which is the only thing that resolves the symmetry. */
        const resolveAndPass = async (): Promise<void> => {
            await timeline.wait(0.5)
            await runtime.moveCubeTo(
                ONCOMING_CUBE_ID,
                { column: RIGHT_FACING_COLUMN, row: BYPASS_ROW },
                { duration: STEP_DURATION_S, easing: 'easeInOutCubic' }
            )
            await runtime.moveCubeTo(
                ONCOMING_CUBE_ID,
                { column: LEFT_FACING_COLUMN - 2, row: BYPASS_ROW },
                { duration: 0.75, easing: 'easeInOutCubic' }
            )
            await runtime.moveCubeTo(
                ONCOMING_CUBE_ID,
                { column: LEFT_FACING_COLUMN - 2, row: CORRIDOR_ROW },
                { duration: STEP_DURATION_S, easing: 'easeInOutCubic' }
            )
            await timeline.wait(0.3)
            await Promise.all([
                runtime.fadeCubeTo(MAIN_CUBE_ID, 0, { duration: 1.1 }),
                runtime.fadeCubeTo(ONCOMING_CUBE_ID, 0, { duration: 1.1 }),
                moveBoth(RIGHT_ENTRY, LEFT_ENTRY, 1.4),
            ])
        }

        await timeline.wait(0.7)
        await timeline.loop(async () => {
            await enterCorridor()
            await timeline.wait(0.45)
            for (let attempt = 0; attempt < MIRRORED_ATTEMPTS; attempt += 1) {
                const row = SIDESTEP_ROWS[attempt]
                if (row === undefined) break
                await mirroredSidestep(row)
            }
            await resolveAndPass()
            await timeline.wait(0.6)
        })
    },
})
