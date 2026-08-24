import type { Quaternion } from 'three'

import { MAIN_CUBE_ID } from '@runtime/grid/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.1
const ROLL_DURATION_S = 1.05
const ROLL_PAUSE_S = 0.32
const QUARTER_TURN = Math.PI / 2

type RollingState = {
    active: boolean
    elapsed: number
    readonly from: Quaternion
    readonly to: Quaternion
    readonly turn: Quaternion
}

/** A cube advances one cell at a time by pivoting around the lower edge facing its path. */
export const RollingCubeScene = defineScene<CubeSceneProps, RollingState>({
    metadata: {
        primaryCategory: 'movement',
        id: 'rolling-cube',
        title: 'Rolling Cube',
        tags: ['movement', 'rotation'],
        description: 'A focused cube rolls forward one grid cell around its lower edge.',
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
    setup: ({ THREE }) => {
        const axis = new THREE.Vector3(0, 0, 1)
        return {
            active: false,
            elapsed: 0,
            from: new THREE.Quaternion(),
            to: new THREE.Quaternion(),
            // A positive-column step rolls clockwise around the world Z axis.
            turn: new THREE.Quaternion().setFromAxisAngle(axis, -QUARTER_TURN),
        }
    },
    script: async ({ runtime, timeline, state }) => {
        const cube = runtime.getCube(MAIN_CUBE_ID)
        if (cube === undefined) return
        let column = 0
        await timeline.wait(0.7)

        await timeline.loop(async () => {
            state.from.copy(cube.quaternion)
            state.to.copy(state.turn).multiply(state.from).normalize()
            state.elapsed = 0
            state.active = true
            column += 1
            await runtime.travelWithCube(
                MAIN_CUBE_ID,
                { column, row: 0 },
                { duration: ROLL_DURATION_S, easing: 'linear' }
            )
            cube.quaternion.copy(state.to)
            state.active = false
            await timeline.wait(ROLL_PAUSE_S)
        })
    },
    onFrame: ({ mesh, delta, state }) => {
        if (!state.active) return

        state.elapsed = Math.min(ROLL_DURATION_S, state.elapsed + delta)
        const progress = state.elapsed / ROLL_DURATION_S
        const angle = progress * QUARTER_TURN
        mesh.quaternion.slerpQuaternions(state.from, state.to, progress)

        // The runtime tracks the cube centre linearly. These offsets make the actual centre
        // follow the circle around the stationary lower edge while the grid travels beneath it.
        mesh.position.x += GRID_CELL_SIZE * (Math.sin(angle) - progress)
        mesh.position.y += (GRID_CELL_SIZE / 2) * (Math.cos(angle) + Math.sin(angle) - 1)
    },
})
