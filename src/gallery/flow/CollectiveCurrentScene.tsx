import { getGridCellKey } from '@runtime/grid/gridPathfinding'
import { MAIN_CUBE_ID, type GridCoordinate } from '@runtime/grid/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.038
const FIELD_RADIUS = 6
const CURRENT_CUBE_IDS = [
    MAIN_CUBE_ID,
    ...Array.from({ length: 11 }, (_, index) => `collective-current-${index}`),
] as const
const INITIAL_POSITIONS: readonly GridCoordinate[] = [
    { column: -5, row: -4 },
    { column: -2, row: -5 },
    { column: 1, row: -4 },
    { column: 4, row: -5 },
    { column: -4, row: -1 },
    { column: 0, row: -1 },
    { column: 4, row: 0 },
    { column: -5, row: 3 },
    { column: -2, row: 4 },
    { column: 1, row: 3 },
    { column: 5, row: 4 },
    { column: 3, row: 6 },
]
const DIRECTIONS: readonly GridCoordinate[] = [
    { column: 1, row: 0 },
    { column: -1, row: 0 },
    { column: 0, row: 1 },
    { column: 0, row: -1 },
]

type CollectiveCurrentState = {
    previousDirectionIndex: number
}

/** Independent cubes repeatedly form and lose a shared direction of travel. */
export const CollectiveCurrentScene = defineScene<CubeSceneProps, CollectiveCurrentState>({
    metadata: {
        primaryCategory: 'flow',
        id: 'collective-current',
        title: 'Collective Current',
        tags: ['coordination', 'emergence'],
        description: 'A shared direction forms out of independent movement.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 19,
        gridFadeInnerRadiusCells: 3.5,
        gridFadeOuterRadiusCells: 10,
        cameraAzimuthDeg: 40,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        CURRENT_CUBE_IDS.forEach((cubeId, index) => {
            const position = INITIAL_POSITIONS[index]
            if (position === undefined) return
            if (cubeId === MAIN_CUBE_ID) runtime.setCubePosition(cubeId, position)
            else runtime.addCube({ id: cubeId, position, faceLabels: props.faceLabels })
        })
        return { previousDirectionIndex: -1 }
    },
    script: async ({ runtime, timeline, random, state }) => {
        const moveOneCell = async (
            cubeId: string,
            preferredDirection?: GridCoordinate
        ): Promise<void> => {
            const source = runtime.getCubePosition(cubeId)
            if (source === undefined) return
            const occupied = new Set(
                CURRENT_CUBE_IDS.flatMap((id) => {
                    if (id === cubeId) return []
                    const position = runtime.getCubePosition(id)
                    return position === undefined ? [] : [getGridCellKey(position)]
                })
            )
            const directions =
                preferredDirection === undefined
                    ? random.shuffle(DIRECTIONS)
                    : [
                          preferredDirection,
                          ...random
                              .shuffle(DIRECTIONS)
                              .filter((direction) => direction !== preferredDirection),
                      ]

            for (const direction of directions) {
                const destination = {
                    column: source.column + direction.column,
                    row: source.row + direction.row,
                }
                if (
                    Math.abs(destination.column) > FIELD_RADIUS ||
                    Math.abs(destination.row) > FIELD_RADIUS ||
                    occupied.has(getGridCellKey(destination))
                )
                    continue

                await runtime.moveCubeTo(cubeId, destination, {
                    duration: 0.16,
                    easing: 'easeInOutCubic',
                })
                return
            }
        }

        const moveDisordered = async (): Promise<void> => {
            for (const cubeId of random.shuffle(CURRENT_CUBE_IDS)) {
                await moveOneCell(cubeId)
                await timeline.wait(0.018)
            }
        }

        const moveAsCurrent = async (direction: GridCoordinate): Promise<void> => {
            const orderedIds = [...CURRENT_CUBE_IDS].sort((leftId, rightId) => {
                const left = runtime.getCubePosition(leftId)
                const right = runtime.getCubePosition(rightId)
                if (left === undefined || right === undefined) return 0
                const leftProjection = left.column * direction.column + left.row * direction.row
                const rightProjection = right.column * direction.column + right.row * direction.row
                return rightProjection - leftProjection
            })
            for (const cubeId of orderedIds) {
                await moveOneCell(cubeId, direction)
                await timeline.wait(0.012)
            }
        }

        await timeline.wait(0.8)
        await timeline.loop(async () => {
            for (let round = 0; round < 3; round += 1) {
                await moveDisordered()
            }

            const directionIndex = random.differentIndex(
                DIRECTIONS.length,
                state.previousDirectionIndex
            )
            state.previousDirectionIndex = directionIndex
            const direction = DIRECTIONS[directionIndex] ?? random.item(DIRECTIONS)
            if (direction === undefined) return

            const initiatorId = random.item(CURRENT_CUBE_IDS)
            if (initiatorId !== undefined) {
                await runtime.fadeCubeTo(initiatorId, 0.3, {
                    duration: 0.2,
                    easing: 'easeOutCubic',
                })
                await runtime.fadeCubeTo(initiatorId, 1, {
                    duration: 0.24,
                    easing: 'easeOutCubic',
                })
            }

            for (let wave = 0; wave < 4; wave += 1) {
                await moveAsCurrent(direction)
            }
            await timeline.wait(0.7)
        })
    },
})
