import type { GridCoordinate } from '../scenes/gridSceneRuntime'
import type { SceneRandom } from '../scenes/sceneRandom'
import { defineScene, type CubeSceneProps } from '../sdk/defineScene'

const GRID_CELL_SIZE = 0.075
const GRID_EDGE = 5
const PASSING_LANES = [-2, -1, 1, 2] as const
const MOVE_DURATION_PER_CELL_S = 0.4
const TURN_CHANCE_PER_MOVE = 0.22

interface CardinalDirection {
    readonly column: -1 | 0 | 1
    readonly row: -1 | 0 | 1
}

interface EntryPlan {
    readonly start: GridCoordinate
    readonly direction: CardinalDirection
}

interface CenteredCubeState {
    waveCounter: number
}

const createEntryPlans = (random: SceneRandom): EntryPlan[] =>
    random.shuffle(
        PASSING_LANES.flatMap((lane): readonly EntryPlan[] => [
            {
                start: { column: -GRID_EDGE, row: lane },
                direction: { column: 1, row: 0 },
            },
            {
                start: { column: GRID_EDGE, row: lane },
                direction: { column: -1, row: 0 },
            },
            {
                start: { column: lane, row: -GRID_EDGE },
                direction: { column: 0, row: 1 },
            },
            {
                start: { column: lane, row: GRID_EDGE },
                direction: { column: 0, row: -1 },
            },
        ])
    )

const getDistanceToExit = (
    position: GridCoordinate,
    direction: CardinalDirection
): number => {
    if (direction.column > 0) return GRID_EDGE - position.column
    if (direction.column < 0) return position.column + GRID_EDGE
    if (direction.row > 0) return GRID_EDGE - position.row
    return position.row + GRID_EDGE
}

const turnPerpendicularly = (
    direction: CardinalDirection,
    random: SceneRandom
): CardinalDirection => {
    const turn: -1 | 1 = random.next() >= 0.5 ? 1 : -1
    return direction.column === 0
        ? { column: turn, row: 0 }
        : { column: 0, row: turn }
}

/** A fixed main cube remains centered while translucent groups occasionally pass nearby. */
export const CenteredCubeScene = defineScene<CubeSceneProps, CenteredCubeState>({
    metadata: {
        id: 'main-cube',
        title: 'Main Cube',
        tags: ['identity', 'focus'],
        description: 'The protagonist holds the centre while others pass through.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 15,
        gridFadeInnerRadiusCells: 2,
        gridFadeOuterRadiusCells: 8,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: () => ({ waveCounter: 0 }),
    script: async ({ runtime, timeline, random, props, state }) => {
        const movePasser = async (
            id: string,
            entryPlan: EntryPlan,
            opacity: number
        ): Promise<void> => {
            let position = entryPlan.start
            let direction = entryPlan.direction
            let moveCount = 0
            let hasTurned = false
            let hasEntered = false

            while (moveCount < 30) {
                const isInsideTurnZone =
                    Math.abs(position.column) <= 3 && Math.abs(position.row) <= 3
                if (
                    !hasTurned &&
                    moveCount >= 2 &&
                    isInsideTurnZone &&
                    random.next() < TURN_CHANCE_PER_MOVE
                ) {
                    direction = turnPerpendicularly(direction, random)
                    hasTurned = true
                }

                const distanceToExit = getDistanceToExit(position, direction)
                if (distanceToExit <= 0) break
                const stepLength = Math.min(
                    1 + Math.floor(random.next() * 3),
                    distanceToExit
                )
                const destination = {
                    column: position.column + direction.column * stepLength,
                    row: position.row + direction.row * stepLength,
                }
                const movement = runtime.moveCubeTo(id, destination, {
                    duration: MOVE_DURATION_PER_CELL_S * stepLength,
                    easing: 'easeInOutCubic',
                })
                if (!hasEntered) {
                    await Promise.all([
                        movement,
                        runtime.fadeCubeTo(id, opacity, {
                            duration: 0.36,
                            easing: 'easeOutCubic',
                        }),
                    ])
                    hasEntered = true
                } else {
                    await movement
                }
                position = runtime.getCubePosition(id) ?? position
                moveCount += 1
            }

            await runtime.fadeCubeTo(id, 0, {
                duration: 0.5,
                easing: 'easeOutCubic',
            })
        }

        await timeline.wait(1.1)
        await timeline.loop(async () => {
            const waveSize = 1 + Math.floor(random.next() * 3)
            const entryPlans = createEntryPlans(random).slice(0, waveSize)
            const passers = entryPlans.map((entryPlan, index) => {
                const id = `center-passer-${state.waveCounter}-${index}`
                runtime.addCube({
                    id,
                    position: entryPlan.start,
                    opacity: 0,
                    faceLabels: props.faceLabels,
                })
                return { id, entryPlan }
            })

            await Promise.all(
                passers.map(({ id, entryPlan }) =>
                    movePasser(id, entryPlan, 0.22 + random.next() * 0.26)
                )
            )
            passers.forEach(({ id }) => runtime.removeCube(id))
            state.waveCounter += 1
            await timeline.wait(1.2 + random.next() * 1.4)
        })
    },
})
