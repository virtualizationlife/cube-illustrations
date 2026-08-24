import { findGridPath, getGridCellKey } from '@scenes/gridPathfinding'
import { MAIN_CUBE_ID, type GridCoordinate } from '@scenes/gridSceneRuntime'
import type { SceneRandom } from '@scenes/sceneRandom'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.027
const GRID_CELL_COUNT = 23
const GRID_RADIUS = 7
const ISLAND_RADIUS = 2
const MOVE_DURATION_PER_CELL_S = 0.22
const TURN_PAUSE_DURATION_S = 0.08
const MOVE_STEP_LENGTHS = [1, 2, 3] as const
const SCATTERED_HOLD_DURATION_S = 1.2
const ISLAND_HOLD_DURATION_S = 1.6

const CUBE_IDS = [
    MAIN_CUBE_ID,
    'scattered-cube-1',
    'scattered-cube-2',
    'scattered-cube-3',
    'scattered-cube-4',
    'scattered-cube-5',
    'scattered-cube-6',
] as const

const CARDINAL_DIRECTIONS: readonly GridCoordinate[] = [
    { column: 1, row: 0 },
    { column: -1, row: 0 },
    { column: 0, row: 1 },
    { column: 0, row: -1 },
]

type CubeLayoutEntry = {
    readonly id: (typeof CUBE_IDS)[number]
    readonly scatteredPosition: GridCoordinate
}

type SevenCubesState = {
    readonly layout: readonly CubeLayoutEntry[]
}

const createRandomIsland = (
    random: SceneRandom,
    cubeCount: number = CUBE_IDS.length
): readonly GridCoordinate[] => {
    const positions: GridCoordinate[] = [{ column: 0, row: 0 }]
    const occupiedCells = new Set([getGridCellKey(positions[0])])

    while (positions.length < cubeCount) {
        const anchor = random.item(positions)
        const direction = random.item(CARDINAL_DIRECTIONS)
        if (anchor === undefined || direction === undefined) continue
        const candidate = {
            column: anchor.column + direction.column,
            row: anchor.row + direction.row,
        }
        if (
            Math.abs(candidate.column) > ISLAND_RADIUS ||
            Math.abs(candidate.row) > ISLAND_RADIUS ||
            occupiedCells.has(getGridCellKey(candidate))
        ) {
            continue
        }
        positions.push(candidate)
        occupiedCells.add(getGridCellKey(candidate))
    }

    return positions
}

const getWaitingPosition = (
    island: readonly GridCoordinate[],
    random: SceneRandom
): GridCoordinate => {
    const occupied = new Set(island.map(getGridCellKey))
    const candidates = random.shuffle(
        island.flatMap((position) =>
            CARDINAL_DIRECTIONS.map((direction) => ({
                column: position.column + direction.column,
                row: position.row + direction.row,
            }))
        )
    )
    return (
        candidates.find(
            (position) =>
                Math.abs(position.column) <= ISLAND_RADIUS + 1 &&
                Math.abs(position.row) <= ISLAND_RADIUS + 1 &&
                !occupied.has(getGridCellKey(position))
        ) ?? { column: ISLAND_RADIUS + 1, row: 0 }
    )
}

const createReconfiguredIsland = (
    provisionalIsland: readonly GridCoordinate[],
    random: SceneRandom
): readonly GridCoordinate[] => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = createRandomIsland(random)
        const candidateCells = new Set(candidate.map(getGridCellKey))
        const changedPositions = provisionalIsland.filter(
            (position) => !candidateCells.has(getGridCellKey(position))
        ).length
        if (changedPositions >= 2) return candidate
    }

    return createRandomIsland(random).map((position) => ({
        column: position.column + 1,
        row: position.row,
    }))
}

const createRandomLayout = (random: SceneRandom): readonly CubeLayoutEntry[] => {
    const availablePositions: GridCoordinate[] = []

    for (let column = -GRID_RADIUS; column <= GRID_RADIUS; column += 1) {
        for (let row = -GRID_RADIUS; row <= GRID_RADIUS; row += 1) {
            const position = { column, row }
            if (Math.abs(column) > ISLAND_RADIUS || Math.abs(row) > ISLAND_RADIUS) {
                availablePositions.push(position)
            }
        }
    }

    const shuffledPositions = random.shuffle(availablePositions)

    return CUBE_IDS.map((id, index) => ({
        id,
        scatteredPosition: shuffledPositions[index],
    }))
}

/** Six cubes gather first, then the group reorganizes to include a random late arrival. */
export const SevenCubesScene = defineScene<CubeSceneProps, SevenCubesState>({
    metadata: {
        id: 'forming-a-group',
        title: 'Forming a Group',
        tags: ['relation', 'organization'],
        description: 'A group forms, then reorganises around a late arrival.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: GRID_CELL_COUNT,
        gridFadeInnerRadiusCells: 4,
        gridFadeOuterRadiusCells: 12,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props, random }) => {
        const layout = createRandomLayout(random)
        for (const cube of layout) {
            if (cube.id === MAIN_CUBE_ID) {
                runtime.setCubePosition(cube.id, cube.scatteredPosition)
            } else {
                runtime.addCube({
                    id: cube.id,
                    position: cube.scatteredPosition,
                    faceLabels: props.faceLabels,
                })
            }
        }
        return { layout }
    },
    script: async ({ runtime, timeline, random, state }) => {
        const { layout } = state

        const moveCubesInRandomTurns = async (
            cubes: readonly CubeLayoutEntry[],
            positions: readonly GridCoordinate[]
        ): Promise<void> => {
            const targets = new Map(cubes.map((cube, index) => [cube.id, positions[index]]))
            const queue = random.shuffle(cubes)

            for (;;) {
                let allCubesPlaced = true
                let movedAtLeastOneCube = false

                for (const cube of queue) {
                    const source = runtime.getCubePosition(cube.id)
                    const target = targets.get(cube.id)
                    if (source === undefined || target === undefined) continue
                    if (getGridCellKey(source) === getGridCellKey(target)) continue
                    allCubesPlaced = false

                    const blockedCells = new Set<string>()
                    for (const otherCube of runtime.getCubes()) {
                        if (otherCube.id === cube.id) continue
                        const otherPosition = runtime.getCubePosition(otherCube.id)
                        if (otherPosition !== undefined) {
                            blockedCells.add(getGridCellKey(otherPosition))
                        }
                    }

                    const path = findGridPath(source, target, blockedCells)
                    if (path === null || path.length === 0) continue
                    const requestedStep = random.item(MOVE_STEP_LENGTHS) ?? 1
                    const stepLength = Math.min(requestedStep, path.length)
                    const destination = path[stepLength - 1]
                    if (destination === undefined) continue

                    await runtime.moveCubeTo(cube.id, destination, {
                        duration: MOVE_DURATION_PER_CELL_S * stepLength,
                        easing: 'easeInOutCubic',
                    })
                    movedAtLeastOneCube = true
                    await timeline.wait(TURN_PAUSE_DURATION_S)
                }

                if (allCubesPlaced || !movedAtLeastOneCube) return
            }
        }

        await timeline.wait(SCATTERED_HOLD_DURATION_S)

        await timeline.loop(async () => {
            const lateCube = random.item(layout)
            if (lateCube === undefined) return
            const earlyCubes = layout.filter((cube) => cube.id !== lateCube.id)
            const provisionalIsland = createRandomIsland(random, earlyCubes.length)

            await moveCubesInRandomTurns(earlyCubes, provisionalIsland)
            await timeline.wait(0.65)

            await moveCubesInRandomTurns(
                [lateCube],
                [getWaitingPosition(provisionalIsland, random)]
            )
            await timeline.wait(0.4)

            await moveCubesInRandomTurns(
                layout,
                createReconfiguredIsland(provisionalIsland, random)
            )
            await timeline.wait(ISLAND_HOLD_DURATION_S)
            await moveCubesInRandomTurns(
                layout,
                layout.map((cube) => cube.scatteredPosition)
            )
            await timeline.wait(SCATTERED_HOLD_DURATION_S)
        })
    },
})
