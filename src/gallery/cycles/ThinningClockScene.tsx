import { MAIN_CUBE_ID, type GridCoordinate } from '@runtime/grid/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.042
const DIAL_POSITIONS: readonly GridCoordinate[] = [
    { column: 2, row: 0 },
    { column: 2, row: 1 },
    { column: 1, row: 2 },
    { column: 0, row: 2 },
    { column: -1, row: 2 },
    { column: -2, row: 1 },
    { column: -2, row: 0 },
    { column: -2, row: -1 },
    { column: -1, row: -2 },
    { column: 0, row: -2 },
    { column: 1, row: -2 },
    { column: 2, row: -1 },
]
/** Where the hand stands while it marks the hour opposite to it. */
const HAND_POSITIONS: readonly GridCoordinate[] = DIAL_POSITIONS.map(({ column, row }) => ({
    column: column * 2,
    row: row * 2,
}))
const DIAL_CUBE_IDS: readonly string[] = DIAL_POSITIONS.map((_, index) => `thinning-clock-${index}`)
const BEAT_START_S = 0.46
const BEAT_DECAY = 0.82
const MARKS_REMOVED_PER_LAP = 2
const MARKS_LEFT_BEFORE_RESET = 2

type ThinningClockState = {
    lap: number
    readonly lit: boolean[]
}

/** A hand circles a dial that keeps losing marks, so every lap is shorter than the last. */
export const ThinningClockScene = defineScene<CubeSceneProps, ThinningClockState>({
    metadata: {
        primaryCategory: 'cycles',
        id: 'thinning-clock',
        title: 'Thinning Clock',
        tags: ['time', 'scarcity'],
        description: 'Each lap of the dial is shorter than the one before it.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 19,
        gridFadeInnerRadiusCells: 4,
        gridFadeOuterRadiusCells: 10,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        const [firstHandPosition] = HAND_POSITIONS
        if (firstHandPosition !== undefined) {
            runtime.setCubePosition(MAIN_CUBE_ID, firstHandPosition)
        }
        DIAL_CUBE_IDS.forEach((cubeId, index) => {
            const position = DIAL_POSITIONS[index]
            if (position === undefined) return
            runtime.addCube({ id: cubeId, position, faceLabels: props.faceLabels })
        })
        return { lap: 0, lit: DIAL_POSITIONS.map(() => true) }
    },
    script: async ({ runtime, timeline, state }) => {
        const refillDial = async (): Promise<void> => {
            for (let index = 0; index < DIAL_CUBE_IDS.length; index += 1) {
                const cubeId = DIAL_CUBE_IDS[index]
                if (cubeId === undefined) continue
                state.lit[index] = true
                void runtime.fadeCubeTo(cubeId, 1, {
                    duration: 0.45,
                    easing: 'easeOutCubic',
                })
                await timeline.wait(0.05)
            }
        }

        const runLap = async (beat: number): Promise<readonly number[]> => {
            const visited: number[] = []
            for (let index = 0; index < DIAL_POSITIONS.length; index += 1) {
                if (!state.lit[index]) continue
                const handPosition = HAND_POSITIONS[index]
                if (handPosition === undefined) continue
                await runtime.moveCubeTo(MAIN_CUBE_ID, handPosition, {
                    duration: beat * 0.8,
                    easing: 'easeInOutCubic',
                })
                visited.push(index)
                await timeline.wait(beat * 0.3)
            }
            return visited
        }

        await timeline.wait(0.8)
        await timeline.loop(async () => {
            const visited = await runLap(BEAT_START_S * BEAT_DECAY ** state.lap)

            // The hand takes the last marks it passed away with it.
            for (const index of visited.slice(-MARKS_REMOVED_PER_LAP)) {
                const cubeId = DIAL_CUBE_IDS[index]
                if (cubeId === undefined) continue
                state.lit[index] = false
                void runtime.fadeCubeTo(cubeId, 0, {
                    duration: 0.5,
                    easing: 'easeOutCubic',
                })
            }
            state.lap += 1

            if (state.lit.filter(Boolean).length > MARKS_LEFT_BEFORE_RESET) return
            await timeline.wait(0.7)
            await refillDial()
            state.lap = 0
            await timeline.wait(0.6)
        })
    },
})
