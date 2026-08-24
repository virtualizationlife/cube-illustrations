import { MAIN_CUBE_ID } from '@runtime/grid/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.1
const JUMP_DURATION_S = 1.1
const JUMP_PAUSE_S = 0.35
const JUMP_HEIGHT_CELLS = 1.1

type JumpState = {
    active: boolean
    elapsed: number
}

/** A focused cube clears one cell and lands on the following cell. */
export const JumpingCubeScene = defineScene<CubeSceneProps, JumpState>({
    metadata: {
        primaryCategory: 'movement',
        id: 'jumping-cube',
        title: 'Jumping Cube',
        tags: ['movement', 'jump'],
        description: 'A focused cube jumps over one grid cell at a time.',
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
    setup: () => ({ active: false, elapsed: 0 }),
    script: async ({ runtime, timeline, state }) => {
        let column = 0
        await timeline.wait(0.7)

        await timeline.loop(async () => {
            state.elapsed = 0
            state.active = true
            column += 2
            await runtime.travelWithCube(
                MAIN_CUBE_ID,
                { column, row: 0 },
                { duration: JUMP_DURATION_S, easing: 'linear' }
            )
            state.active = false
            await timeline.wait(JUMP_PAUSE_S)
        })
    },
    onFrame: ({ mesh, delta, state }) => {
        if (!state.active) return

        state.elapsed = Math.min(JUMP_DURATION_S, state.elapsed + delta)
        const progress = state.elapsed / JUMP_DURATION_S
        mesh.position.y += GRID_CELL_SIZE * JUMP_HEIGHT_CELLS * 4 * progress * (1 - progress)
    },
})
