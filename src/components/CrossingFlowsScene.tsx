import type { GridCubeFaceLabelInput } from '@scenes/cubeFaceLabels'
import { getGridCellKey } from '@scenes/gridPathfinding'
import { MAIN_CUBE_ID, type GridCoordinate, type GridSceneRuntime } from '@scenes/gridSceneRuntime'
import type { SceneRandom } from '@scenes/sceneRandom'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.045
const GRID_CELL_COUNT = 14
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

type FlowCube = {
    readonly id: string
    readonly direction: FlowDirection
    readonly homeRow: number
    detourStepsRemaining: number
}

/** Everything the tick loop and the per-frame opacity pass share. */
type FlowModel = {
    readonly cubes: Map<string, FlowCube>
    cubeCounter: number
    priorityDirection: FlowDirection | null
    nextPriorityDirection: FlowDirection
    priorityTicksRemaining: number
    priorityCooldownTicks: number
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

const getOccupiedCells = (runtime: GridSceneRuntime, model: FlowModel): Map<string, string> => {
    const occupied = new Map<string, string>()
    for (const cube of model.cubes.values()) {
        const position = runtime.getCubePosition(cube.id)
        if (position !== undefined) occupied.set(getGridCellKey(position), cube.id)
    }
    return occupied
}

const getAvailableEntryRows = (
    runtime: GridSceneRuntime,
    model: FlowModel,
    random: SceneRandom,
    direction: FlowDirection
): number[] => {
    const occupied = getOccupiedCells(runtime, model)
    return random
        .shuffle(
            Array.from(
                { length: LANE_MAX_ROW - LANE_MIN_ROW + 1 },
                (_, index) => LANE_MIN_ROW + index
            )
        )
        .filter((row) => !occupied.has(getGridCellKey(getEntryPosition(direction, row))))
}

const spawnCube = (
    runtime: GridSceneRuntime,
    model: FlowModel,
    random: SceneRandom,
    faceLabels: GridCubeFaceLabelInput | undefined,
    direction: FlowDirection,
    requestedRow?: number,
    requestedId?: string
): FlowCube | null => {
    if (model.cubes.size >= MAX_ACTIVE_CUBES) return null
    const availableRows = getAvailableEntryRows(runtime, model, random, direction)
    const row =
        requestedRow !== undefined && availableRows.includes(requestedRow)
            ? requestedRow
            : availableRows[0]
    if (row === undefined) return null

    const canReuseMainCube = !model.cubes.has(MAIN_CUBE_ID) && runtime.hasCube(MAIN_CUBE_ID)
    const id =
        requestedId ??
        (canReuseMainCube ? MAIN_CUBE_ID : `crossing-flow-cube-${model.cubeCounter++}`)
    const position = getEntryPosition(direction, row)

    if (runtime.hasCube(id)) {
        runtime.setCubePosition(id, position)
        runtime.setCubeOpacity(id, 0)
    } else {
        runtime.addCube({ id, position, opacity: 0, faceLabels })
    }

    const cube: FlowCube = { id, direction, homeRow: row, detourStepsRemaining: 0 }
    model.cubes.set(id, cube)
    return cube
}

const getSideStep = (
    runtime: GridSceneRuntime,
    random: SceneRandom,
    cube: FlowCube,
    occupiedCells: ReadonlyMap<string, string>,
    reservedTargets: ReadonlySet<string>
): GridCoordinate | null => {
    const position = runtime.getCubePosition(cube.id)
    if (position === undefined) return null
    const rowOptions = random
        .shuffle([position.row - 1, position.row + 1])
        .filter((row) => row >= LANE_MIN_ROW && row <= LANE_MAX_ROW)
    for (const row of rowOptions) {
        const candidate = { column: position.column, row }
        const key = getGridCellKey(candidate)
        if (!occupiedCells.has(key) && !reservedTargets.has(key)) return candidate
    }
    return null
}

/** Opposing flows yield individually or alternate group priority when traffic grows dense. */
export const CrossingFlowsScene = defineScene<CubeSceneProps, FlowModel>({
    metadata: {
        id: 'crossing-flows',
        title: 'Crossing Flows',
        tags: ['relation', 'coordination'],
        description: 'Opposing traffic yields cube by cube, or by group priority.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: GRID_CELL_COUNT,
        gridFadeInnerRadiusCells: 2,
        gridFadeOuterRadiusCells: 7,
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props, random }) => {
        const model: FlowModel = {
            cubes: new Map<string, FlowCube>(),
            cubeCounter: 0,
            priorityDirection: null,
            nextPriorityDirection: 1,
            priorityTicksRemaining: 0,
            priorityCooldownTicks: 0,
        }

        runtime.setCubeOpacity(MAIN_CUBE_ID, 0)
        runtime.setCubePosition(MAIN_CUBE_ID, getEntryPosition(1, 0))
        model.cubes.set(MAIN_CUBE_ID, {
            id: MAIN_CUBE_ID,
            direction: 1,
            homeRow: 0,
            detourStepsRemaining: 0,
        })
        spawnCube(
            runtime,
            model,
            random,
            props.faceLabels,
            -1,
            0,
            `crossing-flow-cube-${model.cubeCounter++}`
        )

        return model
    },
    script: async ({ runtime, timeline, random, props, state: model }) => {
        const maybeSpawnCubes = (): void => {
            for (const direction of [1, -1] as const) {
                if (model.cubes.size < MAX_ACTIVE_CUBES && random.next() < SPAWN_CHANCE_PER_SIDE) {
                    spawnCube(runtime, model, random, props.faceLabels, direction)
                }
            }
        }

        const moveOneTick = async (): Promise<void> => {
            if (model.priorityDirection === null) {
                model.priorityCooldownTicks = Math.max(0, model.priorityCooldownTicks - 1)
                if (
                    model.cubes.size >= PRIORITY_DENSITY_THRESHOLD &&
                    model.priorityCooldownTicks === 0 &&
                    random.next() < PRIORITY_START_CHANCE
                ) {
                    model.priorityDirection = model.nextPriorityDirection
                    model.priorityTicksRemaining = 3 + Math.floor(random.next() * 2)
                }
            }

            const activePriorityDirection = model.priorityDirection
            const occupiedCells = getOccupiedCells(runtime, model)
            const reservedTargets = new Set<string>()
            const handledCubeIds = new Set<string>()
            const movements = new Map<string, GridCoordinate>()

            for (const cube of random.shuffle([...model.cubes.values()])) {
                if (handledCubeIds.has(cube.id)) continue
                const position = runtime.getCubePosition(cube.id)
                if (position === undefined) continue
                const forward = {
                    column: position.column + cube.direction,
                    row: position.row,
                }
                const blockingCubeId = occupiedCells.get(getGridCellKey(forward))
                const blockingCube =
                    blockingCubeId === undefined ? undefined : model.cubes.get(blockingCubeId)
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
                        ? random.next() < 0.5
                            ? cube
                            : blockingCube
                        : cube.direction === activePriorityDirection
                          ? blockingCube
                          : cube
                const sideStep = getSideStep(
                    runtime,
                    random,
                    yieldingCube,
                    occupiedCells,
                    reservedTargets
                )
                if (sideStep !== null) {
                    movements.set(yieldingCube.id, sideStep)
                    reservedTargets.add(getGridCellKey(sideStep))
                    yieldingCube.detourStepsRemaining = 1
                }
                handledCubeIds.add(cube.id)
                handledCubeIds.add(blockingCube.id)
            }

            for (const cube of random.shuffle([...model.cubes.values()])) {
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
                    candidates.push({
                        column: position.column + cube.direction,
                        row: position.row,
                    })
                } else if (position.row !== cube.homeRow) {
                    candidates.push({
                        column: position.column,
                        row: position.row + Math.sign(cube.homeRow - position.row),
                    })
                }
                if (cube.detourStepsRemaining === 0) {
                    candidates.push({
                        column: position.column + cube.direction,
                        row: position.row,
                    })
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

            for (const cube of [...model.cubes.values()]) {
                const position = runtime.getCubePosition(cube.id)
                if (position === undefined) {
                    model.cubes.delete(cube.id)
                    continue
                }
                const hasExited =
                    (cube.direction === 1 && position.column >= ENTRY_COLUMN) ||
                    (cube.direction === -1 && position.column <= -ENTRY_COLUMN)
                if (!hasExited) continue

                model.cubes.delete(cube.id)
                if (cube.id === MAIN_CUBE_ID) {
                    runtime.setCubeOpacity(cube.id, 0)
                    runtime.setCubePosition(cube.id, MAIN_CUBE_PARKING_POSITION)
                } else {
                    runtime.removeCube(cube.id)
                }
            }

            if (model.priorityDirection !== null) {
                model.priorityTicksRemaining -= 1
                if (model.priorityTicksRemaining <= 0) {
                    model.nextPriorityDirection = model.priorityDirection === 1 ? -1 : 1
                    model.priorityDirection = null
                    model.priorityCooldownTicks = 4
                }
            }
        }

        await timeline.wait(0.35)
        await timeline.loop(async () => {
            maybeSpawnCubes()
            await moveOneTick()
            await timeline.wait(TICK_PAUSE_S)
        })
    },
    onFrame: ({ runtime, state: model }) => {
        for (const cube of model.cubes.values()) {
            const position = runtime.getCubePosition(cube.id)
            if (position !== undefined) {
                runtime.setCubeOpacity(cube.id, getEdgeOpacity(position.column))
            }
        }
    },
    teardown: (_context, model) => {
        model.cubes.clear()
    },
})
