import { MAIN_CUBE_ID, type GridCoordinate } from '@scenes/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

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

const BASE_PRESENTATION = {
    zoom: 1,
    gridOpacity: 0.52,
    gridFadeInnerRadiusCells: 3,
    gridFadeOuterRadiusCells: 10,
} as const

type RememberedThresholdState = {
    thresholdIndex: number
}

/** A cube keeps stepping around a cell whose obstacle disappeared long ago. */
export const RememberedThresholdScene = defineScene<CubeSceneProps, RememberedThresholdState>({
    metadata: {
        id: 'remembered-threshold',
        title: 'Remembered Threshold',
        tags: ['mind', 'residue'],
        description: 'An obstacle is gone; the detour around it remains.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 19,
        gridOpacity: BASE_PRESENTATION.gridOpacity,
        gridFadeInnerRadiusCells: BASE_PRESENTATION.gridFadeInnerRadiusCells,
        gridFadeOuterRadiusCells: BASE_PRESENTATION.gridFadeOuterRadiusCells,
        cameraAzimuthDeg: 15,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    presentation: BASE_PRESENTATION,
    setup: ({ runtime, props }) => {
        runtime.setCubePosition(MAIN_CUBE_ID, ENTRY)
        runtime.setCubeOpacity(MAIN_CUBE_ID, 0)
        runtime.addCube({
            id: THRESHOLD_CUBE_ID,
            position: PARKED,
            opacity: 0,
            faceLabels: props.faceLabels,
        })
        return { thresholdIndex: 0 }
    },
    script: async ({ runtime, timeline, random, state, presentation }) => {
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
            await walkTo({ column: thresholdColumn + 1, row: DETOUR_ROW }, 2)
            await walkTo({ column: thresholdColumn + 1, row: CORRIDOR_ROW }, 1)
        }

        const runPass = async (thresholdColumn: number, hesitation: number): Promise<void> => {
            await enterCorridor()
            await walkTo(
                { column: thresholdColumn - 1, row: CORRIDOR_ROW },
                thresholdColumn - 1 - VISIBLE_START.column
            )
            await timeline.wait(hesitation)
            await stepAround(thresholdColumn)
            await leaveCorridor(thresholdColumn + 1)
        }

        /** The cube finally tests the cell it has been avoiding, and the memory dissolves. */
        const runTestingPass = async (thresholdColumn: number): Promise<void> => {
            await enterCorridor()
            await walkTo(
                { column: thresholdColumn - 1, row: CORRIDOR_ROW },
                thresholdColumn - 1 - VISIBLE_START.column
            )
            presentation?.setTarget({
                zoom: 1.2,
                gridOpacity: 0.72,
                gridFadeInnerRadiusCells: 2,
                gridFadeOuterRadiusCells: 10,
            })
            await timeline.wait(0.95)
            await walkTo({ column: thresholdColumn, row: CORRIDOR_ROW }, 1)
            await timeline.wait(0.3)
            presentation?.setTarget(BASE_PRESENTATION)
            await leaveCorridor(thresholdColumn)
        }

        await timeline.wait(0.8)
        await timeline.loop(async () => {
            const thresholdColumn = THRESHOLD_COLUMNS[state.thresholdIndex] ?? 0

            // A real obstacle, met once.
            runtime.setCubePosition(THRESHOLD_CUBE_ID, {
                column: thresholdColumn,
                row: CORRIDOR_ROW,
            })
            await runtime.fadeCubeTo(THRESHOLD_CUBE_ID, 1, {
                duration: 0.4,
                easing: 'easeOutCubic',
            })
            await runPass(thresholdColumn, 0.6)

            // The obstacle is gone; only the avoidance stays.
            await runtime.fadeCubeTo(THRESHOLD_CUBE_ID, 0, {
                duration: 0.5,
                easing: 'easeOutCubic',
            })
            runtime.setCubePosition(THRESHOLD_CUBE_ID, PARKED)

            for (const hesitation of REMEMBERED_HESITATIONS_S) {
                await runPass(thresholdColumn, hesitation)
            }
            await runTestingPass(thresholdColumn)

            state.thresholdIndex = random.differentIndex(
                THRESHOLD_COLUMNS.length,
                state.thresholdIndex
            )
            await timeline.wait(0.5)
        })
    },
})
