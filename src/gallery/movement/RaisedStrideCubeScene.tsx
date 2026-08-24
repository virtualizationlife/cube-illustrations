import { MAIN_CUBE_ID } from '@runtime/grid/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.1
const LIFT_DURATION_S = 0.7
const TRAVEL_DURATION_S = 1.2
const LAND_DURATION_S = 0.7
const CYCLE_PAUSE_S = 0.32

type StridePhase = 'idle' | 'lifting' | 'traveling' | 'landing'

type RaisedStrideState = {
    phase: StridePhase
    elapsed: number
}

const easeInOutCubic = (progress: number): number =>
    progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2

/** A cube rises one cell, travels two cells above the grid, then settles back down. */
export const RaisedStrideCubeScene = defineScene<CubeSceneProps, RaisedStrideState>({
    metadata: {
        primaryCategory: 'movement',
        id: 'raised-stride-cube',
        title: 'Raised Stride',
        tags: ['movement', 'elevation'],
        description: 'A focused cube rises, travels two cells, and returns to the grid.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 15,
        gridFadeInnerRadiusCells: 1.5,
        gridFadeOuterRadiusCells: 8,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: () => ({ phase: 'idle', elapsed: 0 }),
    script: async ({ runtime, timeline, state }) => {
        let column = 0
        await timeline.wait(0.7)

        await timeline.loop(async () => {
            state.phase = 'lifting'
            state.elapsed = 0
            await timeline.wait(LIFT_DURATION_S)

            state.phase = 'traveling'
            state.elapsed = 0
            column += 2
            await runtime.travelWithCube(
                MAIN_CUBE_ID,
                { column, row: 0 },
                { duration: TRAVEL_DURATION_S, easing: 'easeInOutCubic' }
            )

            state.phase = 'landing'
            state.elapsed = 0
            await timeline.wait(LAND_DURATION_S)
            state.phase = 'idle'
            await timeline.wait(CYCLE_PAUSE_S)
        })
    },
    onFrame: ({ mesh, delta, state }) => {
        if (state.phase === 'idle') return

        const duration =
            state.phase === 'lifting'
                ? LIFT_DURATION_S
                : state.phase === 'landing'
                  ? LAND_DURATION_S
                  : TRAVEL_DURATION_S
        state.elapsed = Math.min(duration, state.elapsed + delta)
        const progress = state.elapsed / duration
        const height =
            state.phase === 'lifting'
                ? easeInOutCubic(progress)
                : state.phase === 'landing'
                  ? 1 - easeInOutCubic(progress)
                  : 1
        mesh.position.y += GRID_CELL_SIZE * height
    },
})
