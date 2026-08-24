import { MAIN_CUBE_ID, type GridCoordinate } from '../scenes/gridSceneRuntime'
import { defineScene } from '../sdk/defineScene'

const GRID_CELL_SIZE = 0.05
const RELAY_ROW = 0
const RELAY_COLUMNS = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const
const EXIT: GridCoordinate = { column: -7, row: RELAY_ROW }
const ENTRY: GridCoordinate = { column: 7, row: RELAY_ROW }
const RELAY_CUBE_IDS = [
    MAIN_CUBE_ID,
    ...Array.from({ length: RELAY_COLUMNS.length - 1 }, (_, index) =>
        `signal-relay-${index}`
    ),
] as const

/** A pulse travels through a line whose carriers continuously leave and rejoin. */
export const SignalRelayScene = defineScene({
    metadata: {
        id: 'signal-relay',
        title: 'Signal Relay',
        tags: ['communication', 'continuity'],
        description: 'A pulse travels through a renewing chain of carriers.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 15,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 8,
        cameraAzimuthDeg: 25,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        RELAY_CUBE_IDS.forEach((cubeId, index) => {
            const column = RELAY_COLUMNS[index]
            if (column === undefined) return
            const position = { column, row: RELAY_ROW }
            if (cubeId === MAIN_CUBE_ID) runtime.setCubePosition(cubeId, position)
            else runtime.addCube({ id: cubeId, position, faceLabels: props.faceLabels })
        })

        return { relay: [...RELAY_CUBE_IDS] }
    },
    script: async ({ runtime, cubes, timeline, state }) => {
        const sendPulse = async (): Promise<void> => {
            await timeline.sequence(state.relay, async (cubeId) => {
                await cubes.get(cubeId).pulse()
                await timeline.wait(0.025)
            })
        }

        const renewRelay = async (): Promise<void> => {
            const departingId = state.relay[0]
            if (departingId === undefined) return

            await Promise.all([
                runtime.moveCubeTo(departingId, EXIT, {
                    duration: 0.42,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(departingId, 0, {
                    duration: 0.42,
                    easing: 'easeOutCubic',
                }),
            ])

            for (let index = 1; index < state.relay.length; index += 1) {
                const cubeId = state.relay[index]
                const destinationColumn = RELAY_COLUMNS[index - 1]
                if (cubeId === undefined || destinationColumn === undefined) continue
                await runtime.moveCubeTo(
                    cubeId,
                    { column: destinationColumn, row: RELAY_ROW },
                    { duration: 0.16, easing: 'easeInOutCubic' }
                )
            }

            runtime.setCubePosition(departingId, ENTRY)
            const tailColumn = RELAY_COLUMNS[RELAY_COLUMNS.length - 1]
            if (tailColumn === undefined) return
            await Promise.all([
                runtime.moveCubeTo(
                    departingId,
                    { column: tailColumn, row: RELAY_ROW },
                    { duration: 0.46, easing: 'easeInOutCubic' }
                ),
                runtime.fadeCubeTo(departingId, 1, {
                    duration: 0.46,
                    easing: 'easeOutCubic',
                }),
            ])
            state.relay.shift()
            state.relay.push(departingId)
        }

        await timeline.wait(0.7)
        await timeline.loop(async () => {
            await sendPulse()
            await timeline.wait(0.45)
            await renewRelay()
            await timeline.wait(0.7)
        })
    },
})
