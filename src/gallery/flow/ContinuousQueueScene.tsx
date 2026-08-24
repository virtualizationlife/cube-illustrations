import { MAIN_CUBE_ID, type GridCoordinate } from '@runtime/grid/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.04
const GRID_CELL_COUNT = 21
const QUEUE_COLUMN = 0
const QUEUE_TAIL_ROW = -4
const QUEUE_HEAD_EXIT_ROW = 8
const QUEUE_SPACING_CELLS = 2
const QUEUE_MOVE_DURATION_S = 0.42
const QUEUE_MOVE_PAUSE_S = 0.035
const NEW_CUBE_MOVE_DURATION_S = 0.85
const CYCLE_PAUSE_S = 0.4

const QUEUE_CUBE_IDS = [
    MAIN_CUBE_ID,
    'queue-cube-1',
    'queue-cube-2',
    'queue-cube-3',
    'queue-cube-4',
    'queue-cube-5',
] as const

const getInitialQueuePosition = (index: number): GridCoordinate => ({
    column: QUEUE_COLUMN,
    row: QUEUE_HEAD_EXIT_ROW - QUEUE_SPACING_CELLS - index * QUEUE_SPACING_CELLS,
})

type ContinuousQueueState = {
    readonly queue: string[]
}

/** A waiting arrival joins only after every queue element advances one by one. */
export const ContinuousQueueScene = defineScene<CubeSceneProps, ContinuousQueueState>({
    metadata: {
        primaryCategory: 'flow',
        id: 'continuous-queue',
        title: 'Continuous Queue',
        tags: ['continuity', 'renewal'],
        description: 'The queue renews itself without ever emptying.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: GRID_CELL_COUNT,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 11,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        for (let index = 0; index < QUEUE_CUBE_IDS.length; index += 1) {
            const cubeId = QUEUE_CUBE_IDS[index]
            if (cubeId === undefined) continue
            const position = getInitialQueuePosition(index)
            if (cubeId === MAIN_CUBE_ID) runtime.setCubePosition(cubeId, position)
            else runtime.addCube({ id: cubeId, position, faceLabels: props.faceLabels })
        }
        return { queue: [...QUEUE_CUBE_IDS] }
    },
    script: async ({ runtime, timeline, random, state }) => {
        const { queue } = state

        const moveForward = async (cubeId: string, fadeOut: boolean): Promise<void> => {
            const source = runtime.getCubePosition(cubeId)
            if (source === undefined) return
            const destination = {
                column: source.column,
                row: source.row + QUEUE_SPACING_CELLS,
            }
            const movement = runtime.moveCubeTo(cubeId, destination, {
                duration: QUEUE_MOVE_DURATION_S,
                easing: 'easeInOutCubic',
            })
            if (fadeOut) {
                await Promise.all([
                    movement,
                    runtime.fadeCubeTo(cubeId, 0, {
                        duration: QUEUE_MOVE_DURATION_S,
                        easing: 'easeInOutCubic',
                    }),
                ])
            } else {
                await movement
            }
        }

        const stageCubeBesideTail = async (cubeId: string): Promise<void> => {
            const approachFromRight = random.next() >= 0.5
            const waitingColumn = approachFromRight ? 6 : -6
            runtime.setCubePosition(cubeId, {
                column: waitingColumn,
                row: QUEUE_TAIL_ROW,
            })
            runtime.setCubeOpacity(cubeId, 0)
            await runtime.fadeCubeTo(cubeId, 0.42, {
                duration: 0.34,
                easing: 'easeOutCubic',
            })
        }

        const bringCubeToTail = async (cubeId: string): Promise<void> => {
            await Promise.all([
                runtime.moveCubeTo(
                    cubeId,
                    { column: QUEUE_COLUMN, row: QUEUE_TAIL_ROW },
                    { duration: NEW_CUBE_MOVE_DURATION_S, easing: 'easeInOutCubic' }
                ),
                runtime.fadeCubeTo(cubeId, 1, {
                    duration: NEW_CUBE_MOVE_DURATION_S,
                    easing: 'easeOutCubic',
                }),
            ])
        }

        await timeline.wait(0.8)
        await timeline.loop(async () => {
            const departingCubeId = queue[0]
            if (departingCubeId === undefined) return

            await moveForward(departingCubeId, true)
            await stageCubeBesideTail(departingCubeId)

            for (let index = 1; index < queue.length; index += 1) {
                const cubeId = queue[index]
                if (cubeId === undefined) continue
                await moveForward(cubeId, false)
                await timeline.wait(QUEUE_MOVE_PAUSE_S)
            }

            await bringCubeToTail(departingCubeId)
            queue.shift()
            queue.push(departingCubeId)
            await timeline.wait(CYCLE_PAUSE_S)
        })
    },
})
