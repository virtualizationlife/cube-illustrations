import { MAIN_CUBE_ID } from '@scenes/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.07
/** Leaves a physical gap between adjacent grid tiles, including while one cube turns. */
const CUBE_SIZE = GRID_CELL_SIZE * 0.78
const PARTNER_CUBE_ID = 'polarity-partner'
const AXIS_ROW = 0
const PARTNER_COLUMN = 4
const CONTACT_COLUMN = 3
const APPROACH_COLUMN = 1
const DISTANT_COLUMN = -2
/** A complete quarter-turn always finishes on a stable cube orientation. */
const TURNED_ANGLE = Math.PI / 2
const SPIN_RESPONSE_S = 0.16
const SPIN_SNAP_EPSILON = 0.0001

type SpinState = {
    current: number
    target: number
}

/** The same pair attracts or repels depending only on how one cube is turned. */
export const PolarityScene = defineScene<CubeSceneProps, SpinState>({
    metadata: {
        id: 'polarity',
        title: 'Polarity',
        tags: ['relation', 'orientation'],
        description: 'One quarter-turn flips attraction into repulsion.',
    },
    view: {
        cubeSize: CUBE_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 15,
        gridFadeInnerRadiusCells: 2.5,
        gridFadeOuterRadiusCells: 8,
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        runtime.setCubePosition(MAIN_CUBE_ID, {
            column: DISTANT_COLUMN,
            row: AXIS_ROW,
        })
        runtime.addCube({
            id: PARTNER_CUBE_ID,
            position: { column: PARTNER_COLUMN, row: AXIS_ROW },
            faceLabels: props.faceLabels,
        })
        return { current: 0, target: 0 }
    },
    script: async ({ runtime, timeline, state }) => {
        const moveTo = (column: number, duration: number): Promise<void> =>
            runtime.moveCubeTo(
                MAIN_CUBE_ID,
                { column, row: AXIS_ROW },
                { duration, easing: 'easeInOutCubic' }
            )

        await timeline.wait(0.8)
        await timeline.loop(async () => {
            // Aligned: the pair drifts together and the last gap closes in a snap.
            state.target = 0
            await moveTo(APPROACH_COLUMN, 0.95)
            await timeline.wait(0.28)
            await moveTo(CONTACT_COLUMN, 0.16)
            await timeline.wait(0.85)

            // Turned: the same pair at the same distance now pushes itself apart.
            state.target = TURNED_ANGLE
            await timeline.wait(0.55)
            await moveTo(CONTACT_COLUMN - 1, 0.14)
            await moveTo(DISTANT_COLUMN, 1.05)
            await timeline.wait(0.8)
        })
    },
    onFrame: ({ mesh, delta, state }) => {
        const progress = 1 - Math.exp(-delta / SPIN_RESPONSE_S)
        state.current += (state.target - state.current) * progress
        // An exponential response is smooth but only approaches its target; snap the final
        // fraction so each turn conclusively reaches 0° or 90° on every loop.
        if (Math.abs(state.target - state.current) < SPIN_SNAP_EPSILON) {
            state.current = state.target
        }
        mesh.rotation.y = state.current
    },
})
