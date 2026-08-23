import { useCallback, useState, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import { findGridPath, getGridCellKey } from '../scenes/gridPathfinding'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
import {
    useSimpleCubeScene,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.03
const GRID_CELL_COUNT = 15
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

interface CubeLayoutEntry {
    readonly id: (typeof CUBE_IDS)[number]
    readonly scatteredPosition: GridCoordinate
}

interface LayoutAnimationController {
    readonly dispose: () => void
}

const shuffle = <Item,>(items: readonly Item[]): Item[] => {
    const shuffled = [...items]
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1))
        const current = shuffled[index]
        shuffled[index] = shuffled[randomIndex]
        shuffled[randomIndex] = current
    }
    return shuffled
}

const createRandomIsland = (
    cubeCount: number = CUBE_IDS.length
): readonly GridCoordinate[] => {
    const positions: GridCoordinate[] = [{ column: 0, row: 0 }]
    const occupiedCells = new Set([getGridCellKey(positions[0])])

    while (positions.length < cubeCount) {
        const anchor = positions[Math.floor(Math.random() * positions.length)]
        const direction =
            CARDINAL_DIRECTIONS[Math.floor(Math.random() * CARDINAL_DIRECTIONS.length)]
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
    island: readonly GridCoordinate[]
): GridCoordinate => {
    const occupied = new Set(island.map(getGridCellKey))
    const candidates = shuffle(
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
    provisionalIsland: readonly GridCoordinate[]
): readonly GridCoordinate[] => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = createRandomIsland()
        const candidateCells = new Set(candidate.map(getGridCellKey))
        const changedPositions = provisionalIsland.filter(
            (position) => !candidateCells.has(getGridCellKey(position))
        ).length
        if (changedPositions >= 2) return candidate
    }

    return createRandomIsland().map((position) => ({
        column: position.column + 1,
        row: position.row,
    }))
}

const createRandomLayout = (): readonly CubeLayoutEntry[] => {
    const availablePositions: GridCoordinate[] = []

    for (let column = -GRID_RADIUS; column <= GRID_RADIUS; column += 1) {
        for (let row = -GRID_RADIUS; row <= GRID_RADIUS; row += 1) {
            const position = { column, row }
            if (Math.abs(column) > ISLAND_RADIUS || Math.abs(row) > ISLAND_RADIUS) {
                availablePositions.push(position)
            }
        }
    }

    const shuffledPositions = shuffle(availablePositions)

    return CUBE_IDS.map((id, index) => ({
        id,
        scatteredPosition: shuffledPositions[index],
    }))
}

const createLayoutAnimation = (
    runtime: GridSceneRuntime,
    layout: readonly CubeLayoutEntry[]
): LayoutAnimationController => {
    let cancelled = false
    const delay = createCancellableDelay()

    const moveCubesInRandomTurns = async (
        cubes: readonly CubeLayoutEntry[],
        positions: readonly GridCoordinate[]
    ): Promise<void> => {
        const targets = new Map(cubes.map((cube, index) => [cube.id, positions[index]]))
        const queue = shuffle(cubes)

        while (!cancelled) {
            let allCubesPlaced = true
            let movedAtLeastOneCube = false

            for (const cube of queue) {
                if (cancelled) return
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
                const requestedStep =
                    MOVE_STEP_LENGTHS[Math.floor(Math.random() * MOVE_STEP_LENGTHS.length)]
                const stepLength = Math.min(requestedStep, path.length)
                const destination = path[stepLength - 1]
                if (destination === undefined) continue

                await runtime.moveCubeTo(cube.id, destination, {
                    duration: MOVE_DURATION_PER_CELL_S * stepLength,
                    easing: 'easeInOutCubic',
                })
                movedAtLeastOneCube = true
                if (!cancelled) await delay.wait(TURN_PAUSE_DURATION_S)
            }

            if (allCubesPlaced || !movedAtLeastOneCube) return
        }
    }

    const play = async (): Promise<void> => {
        await delay.wait(SCATTERED_HOLD_DURATION_S)

        while (!cancelled) {
            const lateCube = layout[Math.floor(Math.random() * layout.length)]
            if (lateCube === undefined) return
            const earlyCubes = layout.filter((cube) => cube.id !== lateCube.id)
            const provisionalIsland = createRandomIsland(earlyCubes.length)

            await moveCubesInRandomTurns(earlyCubes, provisionalIsland)
            if (cancelled) return
            await delay.wait(0.65)
            if (cancelled) return

            await moveCubesInRandomTurns(
                [lateCube],
                [getWaitingPosition(provisionalIsland)]
            )
            if (cancelled) return
            await delay.wait(0.4)
            if (cancelled) return

            await moveCubesInRandomTurns(
                layout,
                createReconfiguredIsland(provisionalIsland)
            )
            if (cancelled) return
            await delay.wait(ISLAND_HOLD_DURATION_S)
            if (cancelled) return
            await moveCubesInRandomTurns(
                layout,
                layout.map((cube) => cube.scatteredPosition)
            )
            if (cancelled) return
            await delay.wait(SCATTERED_HOLD_DURATION_S)
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

/** Six cubes gather first, then the group reorganizes to include a random late arrival. */
export const SevenCubesScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const [layout] = useState(createRandomLayout)

    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            for (const cube of layout) {
                if (cube.id === MAIN_CUBE_ID) {
                    runtime.setCubePosition(cube.id, cube.scatteredPosition)
                } else {
                    runtime.addCube({
                        id: cube.id,
                        position: cube.scatteredPosition,
                        faceLabels,
                    })
                }
            }

            const animation = createLayoutAnimation(runtime, layout)
            return () => animation.dispose()
        },
        [faceLabels, layout]
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
