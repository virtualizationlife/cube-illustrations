import { useCallback, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import { getGridCellKey, isSameGridCell } from '../scenes/gridPathfinding'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
import {
    useSimpleCubeScene,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.042
const GRID_CELL_COUNT = 13
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

interface StructureShape {
    readonly name: string
    readonly positions: readonly GridCoordinate[]
}

interface StructureAnimationController {
    readonly dispose: () => void
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
    isCancelled: () => boolean,
    waitBetweenMoves: () => Promise<void>
): Promise<void> => {
    const assignments = assignNearestTargets(runtime, shape.positions)
    const pendingCubeIds = CUBE_IDS.filter((cubeId) => {
        const source = runtime.getCubePosition(cubeId)
        const target = assignments.get(cubeId)
        return source !== undefined && target !== undefined && !isSameGridCell(source, target)
    })

    while (pendingCubeIds.length > 0 && !isCancelled()) {
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
                if (!isCancelled()) await waitBetweenMoves()
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
        if (!isCancelled()) await waitBetweenMoves()
    }
}

const createStructureAnimation = (runtime: GridSceneRuntime): StructureAnimationController => {
    let cancelled = false
    let currentShapeIndex = 0
    const delay = createCancellableDelay()

    const play = async (): Promise<void> => {
        await delay.wait(SHAPE_HOLD_DURATION_S)
        while (!cancelled) {
            let nextShapeIndex = currentShapeIndex
            while (nextShapeIndex === currentShapeIndex) {
                nextShapeIndex = Math.floor(Math.random() * STRUCTURE_SHAPES.length)
            }
            const nextShape = STRUCTURE_SHAPES[nextShapeIndex]
            if (nextShape === undefined) return
            await moveToShape(
                runtime,
                nextShape,
                () => cancelled,
                () => delay.wait(MOVE_PAUSE_DURATION_S)
            )
            currentShapeIndex = nextShapeIndex
            if (!cancelled) await delay.wait(SHAPE_HOLD_DURATION_S)
        }
    }

    void play()
    return {
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** Sixteen cubes continuously rearrange into a random form from a fixed shape set. */
export const StructureMorphScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            const initialShape = STRUCTURE_SHAPES[0]
            if (initialShape === undefined) return () => undefined

            for (let index = 0; index < CUBE_IDS.length; index += 1) {
                const cubeId = CUBE_IDS[index]
                const position = initialShape.positions[index]
                if (cubeId === undefined || position === undefined) continue
                if (cubeId === MAIN_CUBE_ID) runtime.setCubePosition(cubeId, position)
                else runtime.addCube({ id: cubeId, position, faceLabels })
            }

            const animation = createStructureAnimation(runtime)
            return () => animation.dispose()
        },
        [faceLabels]
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: GRID_CELL_COUNT,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame: () => undefined,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
