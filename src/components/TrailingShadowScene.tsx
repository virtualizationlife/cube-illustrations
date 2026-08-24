import { MAIN_CUBE_ID } from '../scenes/gridSceneRuntime'
import { GRID_PRESETS } from '../scenes/motion'
import { defineScene, type CubeSceneProps } from '../sdk/defineScene'

const GRID_CELL_SIZE = GRID_PRESETS.corridor.gridCellSize
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

interface TrailingShadowState {
    column: number
}

/** A translucent double lags one step behind and only squares up when the cube stops. */
export const TrailingShadowScene = defineScene<CubeSceneProps, TrailingShadowState>({
    metadata: {
        id: 'trailing-shadow',
        title: 'Trailing Shadow',
        tags: ['self', 'delay'],
        description: 'A double one step behind, squaring up only at rest.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: GRID_PRESETS.corridor.gridCellCount,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 9,
        cameraAzimuthDeg: 20,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        runtime.setCubePosition(MAIN_CUBE_ID, {
            column: START_COLUMN,
            row: WALK_ROW,
        })
        runtime.addCube({
            id: SHADOW_CUBE_ID,
            position: { column: START_COLUMN, row: SHADOW_ROW },
            opacity: SHADOW_OPACITY,
            faceLabels: props.faceLabels,
        })
        return { column: START_COLUMN }
    },
    script: async ({ runtime, timeline, state }) => {
        const stepTo = async (nextColumn: number): Promise<void> => {
            const vacatedColumn = state.column
            state.column = nextColumn
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
                    { column: state.column, row: SHADOW_ROW },
                    { duration: STEP_DURATION_S, easing: 'easeOutCubic' }
                ),
                runtime.fadeCubeTo(SHADOW_CUBE_ID, SHADOW_ALIGNED_OPACITY, {
                    duration: STEP_DURATION_S,
                    easing: 'easeOutCubic',
                }),
            ])
            await timeline.wait(0.75)
            await runtime.fadeCubeTo(SHADOW_CUBE_ID, SHADOW_OPACITY, {
                duration: 0.3,
                easing: 'easeOutCubic',
            })
        }

        await timeline.wait(0.8)
        await timeline.loop(async () => {
            for (const leg of WALK_LEGS) {
                const direction = leg.toColumn > state.column ? 1 : -1
                while (state.column !== leg.toColumn) {
                    await stepTo(state.column + direction)
                }
                if (!leg.pause) continue
                await catchUp()
            }
        })
    },
})
