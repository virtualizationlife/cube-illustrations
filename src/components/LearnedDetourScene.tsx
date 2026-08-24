import { MAIN_CUBE_ID, type GridCoordinate } from '../scenes/gridSceneRuntime'
import { GRID_PRESETS } from '../scenes/motion'
import { defineScene } from '../sdk/defineScene'

const GRID_CELL_SIZE = GRID_PRESETS.corridor.gridCellSize
const ENTRY: GridCoordinate = { column: -6, row: 0 }
const VISIBLE_START: GridCoordinate = { column: -4, row: 0 }
const TARGET: GridCoordinate = { column: 4, row: 0 }
const EXIT: GridCoordinate = { column: 6, row: 0 }
const DIRECT_APPROACH: GridCoordinate = { column: -1, row: 0 }
const TOP_BLOCKED_APPROACH: GridCoordinate = { column: -1, row: 2 }
const BOTTOM_BLOCKED_APPROACH: GridCoordinate = { column: -1, row: -2 }
const TOP_ROUTE: readonly GridCoordinate[] = [
    { column: -2, row: 2 },
    { column: 2, row: 2 },
    TARGET,
]
const BOTTOM_ROUTE: readonly GridCoordinate[] = [
    { column: -2, row: -2 },
    { column: 2, row: -2 },
    TARGET,
]
const LOWER_BARRIER: readonly GridCoordinate[] = [
    { column: 0, row: -2 },
    { column: 0, row: -1 },
    { column: 0, row: 0 },
]
const UPPER_BARRIER: readonly GridCoordinate[] = [
    { column: 0, row: 0 },
    { column: 0, row: 1 },
    { column: 0, row: 2 },
]
const BARRIER_CUBE_IDS = ['detour-barrier-0', 'detour-barrier-1', 'detour-barrier-2']

/** A cube learns a detour, then adapts again when the barrier blocks that route. */
export const LearnedDetourScene = defineScene({
    metadata: {
        id: 'learned-detour',
        title: 'Learned Detour',
        tags: ['mind', 'learning'],
        description: 'A route is learned, then relearned when the barrier moves.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: GRID_PRESETS.corridor.gridCellCount,
        gridFadeInnerRadiusCells: 2.5,
        gridFadeOuterRadiusCells: 9,
        cameraAzimuthDeg: 25,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        runtime.setCubePosition(MAIN_CUBE_ID, ENTRY)
        runtime.setCubeOpacity(MAIN_CUBE_ID, 0)
        LOWER_BARRIER.forEach((position, index) => {
            const id = BARRIER_CUBE_IDS[index]
            if (id !== undefined) {
                runtime.addCube({ id, position, faceLabels: props.faceLabels })
            }
        })
    },
    script: async ({ runtime, timeline }) => {
        const moveRoute = async (route: readonly GridCoordinate[]): Promise<void> => {
            for (const position of route) {
                await runtime.moveCubeTo(MAIN_CUBE_ID, position, {
                    duration: 0.62,
                    easing: 'easeInOutCubic',
                })
            }
        }

        const approachBlockedRoute = async (position: GridCoordinate): Promise<void> => {
            await runtime.moveCubeTo(MAIN_CUBE_ID, position, {
                duration: 0.72,
                easing: 'easeInOutCubic',
            })
            await timeline.wait(0.95)
        }

        const enterScene = async (): Promise<void> => {
            await Promise.all([
                runtime.moveCubeTo(MAIN_CUBE_ID, VISIBLE_START, {
                    duration: 0.52,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(MAIN_CUBE_ID, 1, {
                    duration: 0.52,
                    easing: 'easeOutCubic',
                }),
            ])
        }

        const leaveScene = async (): Promise<void> => {
            await timeline.wait(0.45)
            await Promise.all([
                runtime.moveCubeTo(MAIN_CUBE_ID, EXIT, {
                    duration: 0.52,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(MAIN_CUBE_ID, 0, {
                    duration: 0.52,
                    easing: 'easeOutCubic',
                }),
            ])
            runtime.setCubePosition(MAIN_CUBE_ID, ENTRY)
            await timeline.wait(0.42)
        }

        const runJourney = async (
            route: readonly GridCoordinate[],
            blockedApproach?: GridCoordinate
        ): Promise<void> => {
            await enterScene()
            if (blockedApproach !== undefined) {
                await approachBlockedRoute(blockedApproach)
            }
            await moveRoute(route)
            await leaveScene()
        }

        const shiftBarrier = async (moveUp: boolean): Promise<void> => {
            const sourcePositions = moveUp ? LOWER_BARRIER : UPPER_BARRIER
            const targetPositions = moveUp ? UPPER_BARRIER : LOWER_BARRIER
            const indices = moveUp ? [2, 1, 0] : [0, 1, 2]
            for (const index of indices) {
                const source = sourcePositions[index]
                const target = targetPositions[index]
                if (source === undefined || target === undefined) continue
                const cubeId = BARRIER_CUBE_IDS.find((id) => {
                    const position = runtime.getCubePosition(id)
                    return position?.column === source.column && position.row === source.row
                })
                if (cubeId === undefined) continue
                await runtime.moveCubeTo(cubeId, target, {
                    duration: 0.36,
                    easing: 'easeInOutCubic',
                })
            }
            await timeline.wait(0.55)
        }

        await timeline.wait(0.8)

        await runJourney(TOP_ROUTE, DIRECT_APPROACH)
        await runJourney(TOP_ROUTE)

        await timeline.loop(async () => {
            await shiftBarrier(true)
            await runJourney(BOTTOM_ROUTE, TOP_BLOCKED_APPROACH)
            await runJourney(BOTTOM_ROUTE)

            await shiftBarrier(false)
            await runJourney(TOP_ROUTE, BOTTOM_BLOCKED_APPROACH)
            await runJourney(TOP_ROUTE)
        })
    },
})
