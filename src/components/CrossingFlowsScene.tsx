import { useCallback, useRef, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps, GridCubeFaceLabelInput } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import { getGridCellKey } from '../scenes/gridPathfinding'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
import {
    useSimpleCubeScene,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.05
const GRID_CELL_COUNT = 10
const ENTRY_COLUMN = 6
const FULL_OPACITY_COLUMN = 4
const LANE_MIN_ROW = -4
const LANE_MAX_ROW = 4
const MAX_ACTIVE_CUBES = 14
const SPAWN_CHANCE_PER_SIDE = 0.38
const MOVE_DURATION_S = 0.42
const TICK_PAUSE_S = 0.08
const PRIORITY_DENSITY_THRESHOLD = 7
const PRIORITY_START_CHANCE = 0.32
const MAIN_CUBE_PARKING_POSITION: GridCoordinate = { column: 100, row: 100 }

type FlowDirection = -1 | 1

interface FlowCube {
    readonly id: string
    readonly direction: FlowDirection
    readonly homeRow: number
    detourStepsRemaining: number
}

interface FlowAnimationController {
    readonly update: () => void
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

const getEntryPosition = (direction: FlowDirection, row: number): GridCoordinate => ({
    column: direction === 1 ? -ENTRY_COLUMN : ENTRY_COLUMN,
    row,
})

const getEdgeOpacity = (column: number): number => {
    const distance = Math.abs(column)
    if (distance >= ENTRY_COLUMN) return 0
    if (distance <= FULL_OPACITY_COLUMN) return 1
    const progress =
        (ENTRY_COLUMN - distance) / Math.max(0.0001, ENTRY_COLUMN - FULL_OPACITY_COLUMN)
    return progress * progress * (3 - 2 * progress)
}

const createFlowAnimation = (
    runtime: GridSceneRuntime,
    faceLabels: GridCubeFaceLabelInput | undefined
): FlowAnimationController => {
    let cancelled = false
    let cubeCounter = 0
    let priorityDirection: FlowDirection | null = null
    let nextPriorityDirection: FlowDirection = 1
    let priorityTicksRemaining = 0
    let priorityCooldownTicks = 0
    const delay = createCancellableDelay()
    const cubes = new Map<string, FlowCube>()

    const getOccupiedCells = (): Map<string, string> => {
        const occupied = new Map<string, string>()
        for (const cube of cubes.values()) {
            const position = runtime.getCubePosition(cube.id)
            if (position !== undefined) occupied.set(getGridCellKey(position), cube.id)
        }
        return occupied
    }

    const getAvailableEntryRows = (direction: FlowDirection): number[] => {
        const occupied = getOccupiedCells()
        return shuffle(
            Array.from(
                { length: LANE_MAX_ROW - LANE_MIN_ROW + 1 },
                (_, index) => LANE_MIN_ROW + index
            )
        ).filter((row) => !occupied.has(getGridCellKey(getEntryPosition(direction, row))))
    }

    const spawnCube = (
        direction: FlowDirection,
        requestedRow?: number,
        requestedId?: string
    ): FlowCube | null => {
        if (cubes.size >= MAX_ACTIVE_CUBES) return null
        const availableRows = getAvailableEntryRows(direction)
        const row =
            requestedRow !== undefined && availableRows.includes(requestedRow)
                ? requestedRow
                : availableRows[0]
        if (row === undefined) return null

        const canReuseMainCube =
            !cubes.has(MAIN_CUBE_ID) && runtime.hasCube(MAIN_CUBE_ID)
        const id =
            requestedId ??
            (canReuseMainCube ? MAIN_CUBE_ID : `crossing-flow-cube-${cubeCounter++}`)
        const position = getEntryPosition(direction, row)

        if (runtime.hasCube(id)) {
            runtime.setCubePosition(id, position)
            runtime.setCubeOpacity(id, 0)
        } else {
            runtime.addCube({ id, position, opacity: 0, faceLabels })
        }

        const cube: FlowCube = { id, direction, homeRow: row, detourStepsRemaining: 0 }
        cubes.set(id, cube)
        return cube
    }

    runtime.setCubeOpacity(MAIN_CUBE_ID, 0)
    runtime.setCubePosition(MAIN_CUBE_ID, getEntryPosition(1, 0))
    cubes.set(MAIN_CUBE_ID, {
        id: MAIN_CUBE_ID,
        direction: 1,
        homeRow: 0,
        detourStepsRemaining: 0,
    })
    spawnCube(-1, 0, `crossing-flow-cube-${cubeCounter++}`)

    const maybeSpawnCubes = (): void => {
        for (const direction of [1, -1] as const) {
            if (
                cubes.size < MAX_ACTIVE_CUBES &&
                Math.random() < SPAWN_CHANCE_PER_SIDE
            ) {
                spawnCube(direction)
            }
        }
    }

    const getSideStep = (
        cube: FlowCube,
        occupiedCells: ReadonlyMap<string, string>,
        reservedTargets: ReadonlySet<string>
    ): GridCoordinate | null => {
        const position = runtime.getCubePosition(cube.id)
        if (position === undefined) return null
        const rowOptions = shuffle([position.row - 1, position.row + 1]).filter(
            (row) => row >= LANE_MIN_ROW && row <= LANE_MAX_ROW
        )
        for (const row of rowOptions) {
            const candidate = { column: position.column, row }
            const key = getGridCellKey(candidate)
            if (!occupiedCells.has(key) && !reservedTargets.has(key)) return candidate
        }
        return null
    }

    const moveOneTick = async (): Promise<void> => {
        if (priorityDirection === null) {
            priorityCooldownTicks = Math.max(0, priorityCooldownTicks - 1)
            if (
                cubes.size >= PRIORITY_DENSITY_THRESHOLD &&
                priorityCooldownTicks === 0 &&
                Math.random() < PRIORITY_START_CHANCE
            ) {
                priorityDirection = nextPriorityDirection
                priorityTicksRemaining = 3 + Math.floor(Math.random() * 2)
            }
        }

        const activePriorityDirection = priorityDirection
        const occupiedCells = getOccupiedCells()
        const reservedTargets = new Set<string>()
        const handledCubeIds = new Set<string>()
        const movements = new Map<string, GridCoordinate>()

        for (const cube of shuffle([...cubes.values()])) {
            if (handledCubeIds.has(cube.id)) continue
            const position = runtime.getCubePosition(cube.id)
            if (position === undefined) continue
            const forward = { column: position.column + cube.direction, row: position.row }
            const blockingCubeId = occupiedCells.get(getGridCellKey(forward))
            const blockingCube =
                blockingCubeId === undefined ? undefined : cubes.get(blockingCubeId)
            const blockingPosition =
                blockingCubeId === undefined
                    ? undefined
                    : runtime.getCubePosition(blockingCubeId)
            const isHeadOn =
                blockingCube !== undefined &&
                blockingPosition !== undefined &&
                blockingCube.direction === -cube.direction &&
                blockingPosition.row === position.row &&
                blockingPosition.column + blockingCube.direction === position.column

            if (!isHeadOn || blockingCube === undefined) continue
            const yieldingCube =
                activePriorityDirection === null
                    ? Math.random() < 0.5
                        ? cube
                        : blockingCube
                    : cube.direction === activePriorityDirection
                      ? blockingCube
                      : cube
            const sideStep = getSideStep(yieldingCube, occupiedCells, reservedTargets)
            if (sideStep !== null) {
                movements.set(yieldingCube.id, sideStep)
                reservedTargets.add(getGridCellKey(sideStep))
                yieldingCube.detourStepsRemaining = 1
            }
            handledCubeIds.add(cube.id)
            handledCubeIds.add(blockingCube.id)
        }

        for (const cube of shuffle([...cubes.values()])) {
            if (handledCubeIds.has(cube.id)) continue
            if (
                activePriorityDirection !== null &&
                cube.direction !== activePriorityDirection
            ) {
                continue
            }
            const position = runtime.getCubePosition(cube.id)
            if (position === undefined) continue

            const candidates: GridCoordinate[] = []
            if (cube.detourStepsRemaining > 0) {
                candidates.push({ column: position.column + cube.direction, row: position.row })
            } else if (position.row !== cube.homeRow) {
                candidates.push({
                    column: position.column,
                    row: position.row + Math.sign(cube.homeRow - position.row),
                })
            }
            if (cube.detourStepsRemaining === 0) {
                candidates.push({ column: position.column + cube.direction, row: position.row })
            }

            for (const candidate of candidates) {
                const key = getGridCellKey(candidate)
                if (occupiedCells.has(key) || reservedTargets.has(key)) continue
                movements.set(cube.id, candidate)
                reservedTargets.add(key)
                if (cube.detourStepsRemaining > 0) cube.detourStepsRemaining -= 1
                break
            }
        }

        await Promise.all(
            [...movements].map(([cubeId, destination]) =>
                runtime.moveCubeTo(cubeId, destination, {
                    duration: MOVE_DURATION_S,
                    easing: 'easeInOutCubic',
                })
            )
        )

        for (const cube of [...cubes.values()]) {
            const position = runtime.getCubePosition(cube.id)
            if (position === undefined) {
                cubes.delete(cube.id)
                continue
            }
            const hasExited =
                (cube.direction === 1 && position.column >= ENTRY_COLUMN) ||
                (cube.direction === -1 && position.column <= -ENTRY_COLUMN)
            if (!hasExited) continue

            cubes.delete(cube.id)
            if (cube.id === MAIN_CUBE_ID) {
                runtime.setCubeOpacity(cube.id, 0)
                runtime.setCubePosition(cube.id, MAIN_CUBE_PARKING_POSITION)
            } else {
                runtime.removeCube(cube.id)
            }
        }

        if (priorityDirection !== null) {
            priorityTicksRemaining -= 1
            if (priorityTicksRemaining <= 0) {
                nextPriorityDirection = priorityDirection === 1 ? -1 : 1
                priorityDirection = null
                priorityCooldownTicks = 4
            }
        }
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.35)
        while (!cancelled) {
            maybeSpawnCubes()
            await moveOneTick()
            if (!cancelled) await delay.wait(TICK_PAUSE_S)
        }
    }

    void play()
    return {
        update: () => {
            for (const cube of cubes.values()) {
                const position = runtime.getCubePosition(cube.id)
                if (position !== undefined) {
                    runtime.setCubeOpacity(cube.id, getEdgeOpacity(position.column))
                }
            }
        },
        dispose: () => {
            cancelled = true
            delay.cancel()
            cubes.clear()
        },
    }
}

/** Opposing flows yield individually or alternate group priority when traffic grows dense. */
export const CrossingFlowsScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const animationRef = useRef<FlowAnimationController | null>(null)

    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            const animation = createFlowAnimation(runtime, faceLabels)
            animationRef.current = animation
            return () => {
                animation.dispose()
                if (animationRef.current === animation) animationRef.current = null
            }
        },
        [faceLabels]
    )

    const onFrame = useCallback((_context: SimpleCubeFrameContext): void => {
        animationRef.current?.update()
    }, [])

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: GRID_CELL_COUNT,
        gridFadeInnerRadiusCells: 3.5,
        gridFadeOuterRadiusCells: 6,
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
