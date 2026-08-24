import { MAIN_CUBE_ID } from '@runtime/grid/gridSceneRuntime'
import { defineScene } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.1
const STEP_DURATION_S = 0.86
const STEP_PAUSE_S = 0.28

/** A focused cube makes simple one-cell translations along the grid. */
export const SlidingCubeScene = defineScene({
    metadata: {
        primaryCategory: 'movement',
        id: 'sliding-cube',
        title: 'Sliding Cube',
        tags: ['movement', 'translation'],
        description: 'A focused cube slides forward one cell at a time.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 13,
        gridFadeInnerRadiusCells: 1.5,
        gridFadeOuterRadiusCells: 7,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    script: async ({ runtime, timeline }) => {
        let column = 0
        await timeline.wait(0.7)

        await timeline.loop(async () => {
            column += 1
            await runtime.travelWithCube(
                MAIN_CUBE_ID,
                { column, row: 0 },
                { duration: STEP_DURATION_S, easing: 'easeInOutCubic' }
            )
            await timeline.wait(STEP_PAUSE_S)
        })
    },
})
