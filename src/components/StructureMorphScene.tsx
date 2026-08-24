import { getGridCellKey, isSameGridCell } from '@scenes/gridPathfinding'
import { MAIN_CUBE_ID, type GridCoordinate, type GridSceneRuntime } from '@scenes/gridSceneRuntime'
import type { SceneRandom } from '@scenes/sceneRandom'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.035
const GRID_CELL_COUNT = 19
const SHAPE_HOLD_DURATION_S = 1.6
const MOVE_DURATION_PER_CELL_S = 0.09
const MOVE_PAUSE_DURATION_S = 0.035

const CUBE_IDS = [
    MAIN_CUBE_ID,
    'structure-cube-1',
    'structure-cube-2',
    'structure-cube-3',
    'structure-cube-4',
    'structure-cube-5',
    'structure-cube-6',
    'structure-cube-7',
    'structure-cube-8',
    'structure-cube-9',
    'structure-cube-10',
    'structure-cube-11',
    'structure-cube-12',
    'structure-cube-13',
    'structure-cube-14',
    'structure-cube-15',
] as const

type StructureShape = {
    readonly name: string
    readonly positions: readonly GridCoordinate[]
}

type StructureMorphState = {
    currentShapeIndex: number
}

const prioritizeOrigin = (positions: readonly GridCoordinate[]): GridCoordinate[] =>
    [...positions].sort((left, right) => {
        const leftIsOrigin = left.column === 0 && left.row === 0
        const rightIsOrigin = right.column === 0 && right.row === 0
        return Number(rightIsOrigin) - Number(leftIsOrigin)
    })

const createRectangle = (
    firstColumn: number,
    firstRow: number,
    width: number,
    height: number
): GridCoordinate[] => {
    const positions: GridCoordinate[] = []
    for (let rowOffset = 0; rowOffset < height; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < width; columnOffset += 1) {
            positions.push({
                column: firstColumn + columnOffset,
                row: firstRow + rowOffset,
            })
        }
    }
    return positions
}

const createFrame = (radius: number): GridCoordinate[] => {
    const positions: GridCoordinate[] = []
    for (let row = -radius; row <= radius; row += 1) {
        for (let column = -radius; column <= radius; column += 1) {
            if (Math.max(Math.abs(column), Math.abs(row)) === radius) {
                positions.push({ column, row })
            }
        }
    }
    return positions
}

const STRUCTURE_SHAPES: readonly StructureShape[] = [
    {
        name: 'square',
        positions: prioritizeOrigin(createRectangle(-1, -1, 4, 4)),
    },
    {
        name: 'frame',
        positions: createFrame(2),
    },
    {
        name: 'parallel-lines',
        positions: [-1, 1].flatMap((row) =>
            Array.from({ length: 8 }, (_, index) => ({ column: index - 4, row }))
        ),
    },
    {
        name: 'four-blocks',
        positions: [
            ...createRectangle(-3, -3, 2, 2),
            ...createRectangle(2, -3, 2, 2),
            ...createRectangle(-3, 2, 2, 2),
            ...createRectangle(2, 2, 2, 2),
        ],
    },
    {
        name: 'zigzag',
        positions: Array.from({ length: 16 }, (_, index) => ({
            column: (index % 8) - 4,
            row: index < 8 ? (index % 2 === 0 ? -1 : 0) : index % 2 === 0 ? 1 : 2,
        })),
    },
]

const getGridDistance = (from: GridCoordinate, to: GridCoordinate): number =>
    Math.abs(to.column - from.column) + Math.abs(to.row - from.row)

const assignNearestTargets = (
    runtime: GridSceneRuntime,
    targets: readonly GridCoordinate[]
): Map<string, GridCoordinate> => {
    const remainingCubeIds = [...CUBE_IDS]
    const remainingTargets = [...targets]
    const assignments = new Map<string, GridCoordinate>()

    while (remainingCubeIds.length > 0) {
        let bestCubeIndex = 0
        let bestTargetIndex = 0
        let bestDistance = Number.POSITIVE_INFINITY

        for (let cubeIndex = 0; cubeIndex < remainingCubeIds.length; cubeIndex += 1) {
            const position = runtime.getCubePosition(remainingCubeIds[cubeIndex])
            if (position === undefined) continue
            for (let targetIndex = 0; targetIndex < remainingTargets.length; targetIndex += 1) {
                const distance = getGridDistance(position, remainingTargets[targetIndex])
                if (distance < bestDistance) {
                    bestDistance = distance
                    bestCubeIndex = cubeIndex
                    bestTargetIndex = targetIndex
                }
            }
        }

        const [cubeId] = remainingCubeIds.splice(bestCubeIndex, 1)
        const [target] = remainingTargets.splice(bestTargetIndex, 1)
        if (cubeId !== undefined && target !== undefined) assignments.set(cubeId, target)
    }

    return assignments
}

const TEMPORARY_POSITIONS: readonly GridCoordinate[] = [
    { column: -5, row: -5 },
    { column: 5, row: -5 },
    { column: -5, row: 5 },
    { column: 5, row: 5 },
    { column: 0, row: -5 },
    { column: 0, row: 5 },
]

const moveCube = async (
    runtime: GridSceneRuntime,
    cubeId: string,
    destination: GridCoordinate
): Promise<void> => {
    const source = runtime.getCubePosition(cubeId)
    if (source === undefined || isSameGridCell(source, destination)) return
    await runtime.moveCubeTo(cubeId, destination, {
        duration: Math.max(0.24, getGridDistance(source, destination) * MOVE_DURATION_PER_CELL_S),
        easing: 'easeInOutCubic',
    })
}

const moveToShape = async (
    runtime: GridSceneRuntime,
    shape: StructureShape,
    random: SceneRandom,
    waitBetweenMoves: () => Promise<void>
): Promise<void> => {
    const assignments = assignNearestTargets(runtime, shape.positions)
    const pendingCubeIds = CUBE_IDS.filter((cubeId) => {
        const source = runtime.getCubePosition(cubeId)
        const target = assignments.get(cubeId)
        return source !== undefined && target !== undefined && !isSameGridCell(source, target)
    })
    const seedCubeId = random.item(pendingCubeIds)
    const seedPosition = seedCubeId === undefined ? undefined : runtime.getCubePosition(seedCubeId)
    if (seedCubeId !== undefined && seedPosition !== undefined) {
        pendingCubeIds.sort((leftId, rightId) => {
            const leftPosition = runtime.getCubePosition(leftId)
            const rightPosition = runtime.getCubePosition(rightId)
            if (leftPosition === undefined || rightPosition === undefined) return 0
            return (
                getGridDistance(seedPosition, leftPosition) -
                getGridDistance(seedPosition, rightPosition)
            )
        })
        await runtime.fadeCubeTo(seedCubeId, 0.32, {
            duration: 0.16,
            easing: 'easeOutCubic',
        })
        await runtime.fadeCubeTo(seedCubeId, 1, {
            duration: 0.18,
            easing: 'easeOutCubic',
        })
    }

    while (pendingCubeIds.length > 0) {
        const occupiedCells = new Map<string, string>()
        for (const cubeId of CUBE_IDS) {
            const position = runtime.getCubePosition(cubeId)
            if (position !== undefined) occupiedCells.set(getGridCellKey(position), cubeId)
        }

        const movableIndex = pendingCubeIds.findIndex((cubeId) => {
            const target = assignments.get(cubeId)
            if (target === undefined) return false
            const occupant = occupiedCells.get(getGridCellKey(target))
            return occupant === undefined || occupant === cubeId
        })

        if (movableIndex >= 0) {
            const [cubeId] = pendingCubeIds.splice(movableIndex, 1)
            const target = cubeId === undefined ? undefined : assignments.get(cubeId)
            if (cubeId !== undefined && target !== undefined) {
                await moveCube(runtime, cubeId, target)
                await waitBetweenMoves()
            }
            continue
        }

        const cubeId = pendingCubeIds[0]
        if (cubeId === undefined) return
        const assignedTargetKeys = new Set(
            [...assignments.values()].map((position) => getGridCellKey(position))
        )
        const temporaryPosition = TEMPORARY_POSITIONS.find(
            (position) =>
                !occupiedCells.has(getGridCellKey(position)) &&
                !assignedTargetKeys.has(getGridCellKey(position))
        )
        if (temporaryPosition === undefined) return
        await moveCube(runtime, cubeId, temporaryPosition)
        await waitBetweenMoves()
    }
}

/** A random seed cube starts each spatial chain reaction into a new group form. */
export const StructureMorphScene = defineScene<CubeSceneProps, StructureMorphState>({
    metadata: {
        id: 'random-structure',
        title: 'Random Structure',
        tags: ['form', 'reconfiguration'],
        description: 'A seed cube starts each reconfiguration into a new form.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: GRID_CELL_COUNT,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 10,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        const initialShape = STRUCTURE_SHAPES[0]
        if (initialShape !== undefined) {
            for (let index = 0; index < CUBE_IDS.length; index += 1) {
                const cubeId = CUBE_IDS[index]
                const position = initialShape.positions[index]
                if (cubeId === undefined || position === undefined) continue
                if (cubeId === MAIN_CUBE_ID) runtime.setCubePosition(cubeId, position)
                else runtime.addCube({ id: cubeId, position, faceLabels: props.faceLabels })
            }
        }
        return { currentShapeIndex: 0 }
    },
    script: async ({ runtime, timeline, random, state }) => {
        await timeline.wait(SHAPE_HOLD_DURATION_S)
        await timeline.loop(async () => {
            const nextShapeIndex = random.differentIndex(
                STRUCTURE_SHAPES.length,
                state.currentShapeIndex
            )
            const nextShape = STRUCTURE_SHAPES[nextShapeIndex]
            if (nextShape === undefined) return
            await moveToShape(runtime, nextShape, random, () =>
                timeline.wait(MOVE_PAUSE_DURATION_S)
            )
            state.currentShapeIndex = nextShapeIndex
            await timeline.wait(SHAPE_HOLD_DURATION_S)
        })
    },
})
