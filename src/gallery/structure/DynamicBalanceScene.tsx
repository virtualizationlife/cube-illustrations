import { MAIN_CUBE_ID, type GridCoordinate } from '@runtime/grid/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.055
const EDGE_DISTANCE = 7
const RING_POSITIONS: readonly GridCoordinate[] = [
    { column: 0, row: -1 },
    { column: 1, row: -1 },
    { column: 1, row: 0 },
    { column: 1, row: 1 },
    { column: 0, row: 1 },
    { column: -1, row: 1 },
    { column: -1, row: 0 },
    { column: -1, row: -1 },
]
const BALANCE_CUBE_IDS = Array.from(
    { length: RING_POSITIONS.length },
    (_, index) => `dynamic-balance-${index}`
)

const getEdgePosition = ({ column, row }: GridCoordinate): GridCoordinate => ({
    column: column * EDGE_DISTANCE,
    row: row * EDGE_DISTANCE,
})

type DynamicBalanceState = {
    readonly assignments: (string | null)[]
    carrierId: string
    gapIndex: number
}

/** A compact group exchanges one member and redistributes its vacancy indefinitely. */
export const DynamicBalanceScene = defineScene<CubeSceneProps, DynamicBalanceState>({
    metadata: {
        primaryCategory: 'structure',
        id: 'dynamic-balance',
        title: 'Dynamic Balance',
        tags: ['maintenance', 'stability'],
        description: 'A ring keeps its shape while its members are exchanged.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 17,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 9,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        runtime.setCubePosition(MAIN_CUBE_ID, { column: 0, row: 0 })
        const gapIndex = 0
        const assignments: (string | null)[] = Array.from(
            { length: RING_POSITIONS.length },
            () => null
        )
        let carrierId = ''

        BALANCE_CUBE_IDS.forEach((cubeId, index) => {
            if (index === gapIndex) {
                carrierId = cubeId
                const gapPosition = RING_POSITIONS[gapIndex]
                if (gapPosition !== undefined) {
                    runtime.addCube({
                        id: cubeId,
                        position: getEdgePosition(gapPosition),
                        opacity: 0,
                        faceLabels: props.faceLabels,
                    })
                }
                return
            }
            const position = RING_POSITIONS[index]
            if (position === undefined) return
            assignments[index] = cubeId
            runtime.addCube({ id: cubeId, position, faceLabels: props.faceLabels })
        })

        return { assignments, carrierId, gapIndex }
    },
    script: async ({ runtime, timeline, random, state }) => {
        const { assignments } = state

        await timeline.wait(0.8)
        await timeline.loop(async () => {
            const gapPosition = RING_POSITIONS[state.gapIndex]
            if (gapPosition === undefined) return
            await Promise.all([
                runtime.moveCubeTo(state.carrierId, gapPosition, {
                    duration: 0.72,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(state.carrierId, 1, {
                    duration: 0.72,
                    easing: 'easeOutCubic',
                }),
            ])
            assignments[state.gapIndex] = state.carrierId
            await timeline.wait(0.4)

            state.gapIndex = (state.gapIndex + 4) % RING_POSITIONS.length
            const outgoingId = assignments[state.gapIndex]
            const outgoingPosition = RING_POSITIONS[state.gapIndex]
            if (outgoingId === null || outgoingId === undefined || outgoingPosition === undefined) {
                return
            }
            assignments[state.gapIndex] = null
            await Promise.all([
                runtime.moveCubeTo(outgoingId, getEdgePosition(outgoingPosition), {
                    duration: 0.72,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(outgoingId, 0, {
                    duration: 0.72,
                    easing: 'easeOutCubic',
                }),
            ])
            state.carrierId = outgoingId

            const rotationDirection = random.next() >= 0.5 ? 1 : -1
            const redistributionSteps = 1 + Math.floor(random.next() * 3)
            for (let step = 0; step < redistributionSteps; step += 1) {
                const sourceIndex =
                    (state.gapIndex + rotationDirection + RING_POSITIONS.length) %
                    RING_POSITIONS.length
                const movingId = assignments[sourceIndex]
                const destination = RING_POSITIONS[state.gapIndex]
                if (movingId === null || movingId === undefined || destination === undefined) {
                    return
                }
                await runtime.moveCubeTo(movingId, destination, {
                    duration: 0.28,
                    easing: 'easeInOutCubic',
                })
                assignments[state.gapIndex] = movingId
                assignments[sourceIndex] = null
                state.gapIndex = sourceIndex
                await timeline.wait(0.08)
            }
            await timeline.wait(0.6)
        })
    },
})
