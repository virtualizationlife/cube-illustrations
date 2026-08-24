import { MAIN_CUBE_ID, type GridCoordinate } from '../scenes/gridSceneRuntime'
import { defineScene } from '../sdk/defineScene'

const GRID_CELL_SIZE = 0.05
const PARTNER_CUBE_ID = 'relationship-partner'
const START_PAIR: readonly [GridCoordinate, GridCoordinate] = [
    { column: -4, row: -1 },
    { column: -4, row: 1 },
]
const LEFT_APPROACH: readonly [GridCoordinate, GridCoordinate] = [
    { column: -2, row: -1 },
    { column: -2, row: 1 },
]
const RIGHT_MEETING: readonly [GridCoordinate, GridCoordinate] = [
    { column: 3, row: -1 },
    { column: 3, row: 1 },
]
const RIGHT_SYNC_STEP: readonly [GridCoordinate, GridCoordinate] = [
    { column: 4, row: -1 },
    { column: 4, row: 1 },
]
const MAIN_FORWARD_SHORT_ROUTE: readonly GridCoordinate[] = [
    { column: -1, row: -2 },
    { column: 1, row: -2 },
    RIGHT_MEETING[0],
]
const PARTNER_FORWARD_LONG_ROUTE: readonly GridCoordinate[] = [
    { column: -2, row: 3 },
    { column: 0, row: 4 },
    { column: 2, row: 3 },
    RIGHT_MEETING[1],
]
const MAIN_RETURN_LONG_ROUTE: readonly GridCoordinate[] = [
    { column: 2, row: -3 },
    { column: 0, row: -4 },
    { column: -2, row: -3 },
    { column: -3, row: -1 },
]
const PARTNER_RETURN_SHORT_ROUTE: readonly GridCoordinate[] = [
    { column: 1, row: 2 },
    { column: -1, row: 2 },
    { column: -3, row: 1 },
]
const BARRIER_POSITIONS: readonly GridCoordinate[] = [
    { column: 0, row: -1 },
    { column: 0, row: 0 },
    { column: 0, row: 1 },
]

/** Two cubes take unequal routes, wait for each other, and restore their paired movement. */
export const ReunitingPairScene = defineScene({
    metadata: {
        id: 'reuniting-pair',
        title: 'Reuniting Pair',
        tags: ['continuity', 'relationship'],
        description: 'Unequal routes that end in restored paired movement.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 15,
        cameraAzimuthDeg: 20,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        runtime.setCubePosition(MAIN_CUBE_ID, START_PAIR[0])
        runtime.addCube({
            id: PARTNER_CUBE_ID,
            position: START_PAIR[1],
            faceLabels: props.faceLabels,
        })
        BARRIER_POSITIONS.forEach((position, index) => {
            runtime.addCube({
                id: `relationship-barrier-${index}`,
                position,
                faceLabels: props.faceLabels,
            })
        })
    },
    script: async ({ runtime, timeline }) => {
        const movePair = (
            destinations: readonly [GridCoordinate, GridCoordinate]
        ): Promise<unknown> =>
            Promise.all([
                runtime.moveCubeTo(MAIN_CUBE_ID, destinations[0], {
                    duration: 0.62,
                    easing: 'easeInOutCubic',
                }),
                runtime.moveCubeTo(PARTNER_CUBE_ID, destinations[1], {
                    duration: 0.62,
                    easing: 'easeInOutCubic',
                }),
            ])

        const moveCubeRoute = async (
            cubeId: string,
            route: readonly GridCoordinate[],
            duration: number
        ): Promise<void> => {
            for (const destination of route) {
                await runtime.moveCubeTo(cubeId, destination, {
                    duration,
                    easing: 'easeInOutCubic',
                })
                await timeline.wait(0.06)
            }
        }

        await timeline.wait(0.8)
        await timeline.loop(async () => {
            await movePair(LEFT_APPROACH)
            await Promise.all([
                moveCubeRoute(MAIN_CUBE_ID, MAIN_FORWARD_SHORT_ROUTE, 0.42),
                moveCubeRoute(PARTNER_CUBE_ID, PARTNER_FORWARD_LONG_ROUTE, 0.56),
            ])
            await timeline.wait(0.65)
            await movePair(RIGHT_SYNC_STEP)
            await timeline.wait(0.9)

            await movePair(RIGHT_MEETING)
            await Promise.all([
                moveCubeRoute(MAIN_CUBE_ID, MAIN_RETURN_LONG_ROUTE, 0.56),
                moveCubeRoute(PARTNER_CUBE_ID, PARTNER_RETURN_SHORT_ROUTE, 0.42),
            ])
            await timeline.wait(0.65)
            await movePair(START_PAIR)
            await timeline.wait(0.9)
        })
    },
})
