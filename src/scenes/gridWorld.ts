import {
    findGridPath,
    getGridCellKey,
    normalizeGridCoordinate,
    type GridCoordinate,
} from './gridPathfinding'

export type { GridCoordinate } from './gridPathfinding'

export type GridSceneEasing = 'linear' | 'easeInOutCubic' | 'easeOutCubic'

export interface GridSceneTransitionOptions {
    /** Animation duration in seconds. */
    readonly duration: number
    readonly easing?: GridSceneEasing
}

export interface GridWorldCubeDefinition {
    readonly id: string
    readonly position?: GridCoordinate
    readonly occupiesCell?: boolean
}

export interface GridWorld {
    readonly addCube: (definition: GridWorldCubeDefinition) => void
    readonly removeCube: (id: string) => void
    readonly hasCube: (id: string) => boolean
    readonly getCubeRevision: () => number
    readonly getCubePosition: (id: string) => GridCoordinate | undefined
    readonly setCubePosition: (id: string, position: GridCoordinate) => void
    readonly setCubeOccupiesCell: (id: string, occupiesCell: boolean) => void
    readonly moveCubeTo: (
        id: string,
        position: GridCoordinate,
        options: GridSceneTransitionOptions
    ) => Promise<void>
    readonly getGridFocus: () => GridCoordinate
    readonly setGridFocus: (position: GridCoordinate) => void
    readonly moveGridFocusTo: (
        position: GridCoordinate,
        options: GridSceneTransitionOptions
    ) => Promise<void>
    readonly travelWithCube: (
        id: string,
        position: GridCoordinate,
        options: GridSceneTransitionOptions
    ) => Promise<void>
    readonly update: (delta: number) => void
    readonly dispose: () => void
}

interface MutableGridCoordinate {
    column: number
    row: number
}

interface CoordinateTransition {
    elapsed: number
    readonly duration: number
    readonly easing: GridSceneEasing
    readonly from: GridCoordinate
    readonly to: GridCoordinate
    readonly resolve: () => void
}

interface CubeMovement {
    readonly path: readonly GridCoordinate[]
    readonly segmentDuration: number
    readonly easing: GridSceneEasing
    readonly reservedCellKeys: readonly string[]
    readonly resolve: () => void
    segmentIndex: number
    transition: CoordinateTransition
}

interface GridWorldCubeRecord {
    readonly position: MutableGridCoordinate
    occupiesCell: boolean
    movement: CubeMovement | null
}

interface TrackedTravel {
    readonly cubeId: string
    readonly token: symbol
}

const applyEasing = (progress: number, easing: GridSceneEasing): number => {
    switch (easing) {
        case 'linear':
            return progress
        case 'easeOutCubic':
            return 1 - (1 - progress) ** 3
        case 'easeInOutCubic':
            return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
    }
}

const getTransitionProgress = (transition: {
    readonly elapsed: number
    readonly duration: number
}): number =>
    transition.duration === 0 ? 1 : Math.min(1, transition.elapsed / transition.duration)

const createCoordinateTransitionState = (
    from: GridCoordinate,
    to: GridCoordinate,
    options: GridSceneTransitionOptions,
    resolve = (): void => undefined
): CoordinateTransition => ({
    elapsed: 0,
    duration: Math.max(0, options.duration),
    easing: options.easing ?? 'easeInOutCubic',
    from: { column: from.column, row: from.row },
    to: { column: to.column, row: to.row },
    resolve,
})

const createCoordinateTransition = (
    from: GridCoordinate,
    to: GridCoordinate,
    options: GridSceneTransitionOptions
): { readonly transition: CoordinateTransition; readonly completion: Promise<void> } => {
    let resolveTransition = (): void => undefined
    const completion = new Promise<void>((resolve) => {
        resolveTransition = resolve
    })

    return {
        transition: createCoordinateTransitionState(from, to, options, resolveTransition),
        completion,
    }
}

const advanceCoordinateTransition = (
    transition: CoordinateTransition,
    delta: number,
    target: MutableGridCoordinate
): boolean => {
    transition.elapsed += delta
    const progress = getTransitionProgress(transition)
    const eased = applyEasing(progress, transition.easing)
    target.column = transition.from.column + (transition.to.column - transition.from.column) * eased
    target.row = transition.from.row + (transition.to.row - transition.from.row) * eased
    return progress >= 1
}

/** Pure grid state and movement model. It has no dependency on React, Three, or WebGPU. */
export const createGridWorld = (): GridWorld => {
    const cubes = new Map<string, GridWorldCubeRecord>()
    const reservedCells = new Map<string, string>()
    const gridFocus: MutableGridCoordinate = { column: 0, row: 0 }
    let gridTransition: CoordinateTransition | null = null
    let trackedTravel: TrackedTravel | null = null
    let cubeRevision = 0
    let disposed = false

    const requireCube = (id: string): GridWorldCubeRecord => {
        const cube = cubes.get(id)
        if (cube === undefined) throw new Error(`Unknown cube id "${id}"`)
        return cube
    }

    const getBlockedCellKeys = (excludedCubeId?: string): Set<string> => {
        const blocked = new Set<string>()
        for (const [cubeId, cube] of cubes) {
            if (cubeId !== excludedCubeId && cube.occupiesCell) {
                blocked.add(getGridCellKey(cube.position))
            }
        }
        for (const [cellKey, cubeId] of reservedCells) {
            if (cubeId !== excludedCubeId) blocked.add(cellKey)
        }
        return blocked
    }

    const assertCellAvailable = (position: GridCoordinate, excludedCubeId?: string): void => {
        if (getBlockedCellKeys(excludedCubeId).has(getGridCellKey(position))) {
            throw new Error(`Grid cell ${getGridCellKey(position)} is already occupied`)
        }
    }

    const releaseMovementReservations = (cubeId: string, movement: CubeMovement): void => {
        for (const cellKey of movement.reservedCellKeys) {
            if (reservedCells.get(cellKey) === cubeId) reservedCells.delete(cellKey)
        }
    }

    const finishCubeMovement = (cubeId: string, cube: GridWorldCubeRecord): void => {
        const movement = cube.movement
        if (movement === null) return
        cube.movement = null
        releaseMovementReservations(cubeId, movement)
        movement.resolve()
    }

    const addCube = (definition: GridWorldCubeDefinition): void => {
        if (disposed) throw new Error('Cannot add a cube to a disposed grid world')
        if (cubes.has(definition.id)) {
            throw new Error(`A cube with id "${definition.id}" already exists`)
        }
        const position = normalizeGridCoordinate(definition.position ?? { column: 0, row: 0 })
        const occupiesCell = definition.occupiesCell ?? true
        if (occupiesCell) assertCellAvailable(position)
        cubes.set(definition.id, {
            position: { column: position.column, row: position.row },
            occupiesCell,
            movement: null,
        })
        cubeRevision += 1
    }

    const removeCube = (id: string): void => {
        const cube = cubes.get(id)
        if (cube === undefined) return
        finishCubeMovement(id, cube)
        cubes.delete(id)
        cubeRevision += 1
    }

    const setCubePosition = (id: string, position: GridCoordinate): void => {
        const cube = requireCube(id)
        const normalizedPosition = normalizeGridCoordinate(position)
        if (cube.occupiesCell) assertCellAvailable(normalizedPosition, id)
        finishCubeMovement(id, cube)
        cube.position.column = normalizedPosition.column
        cube.position.row = normalizedPosition.row
    }

    const moveCubeTo = (
        id: string,
        position: GridCoordinate,
        options: GridSceneTransitionOptions
    ): Promise<void> => {
        const cube = requireCube(id)
        finishCubeMovement(id, cube)
        const destination = normalizeGridCoordinate(position)
        const blockedCellKeys = cube.occupiesCell ? getBlockedCellKeys(id) : new Set<string>()
        const path = findGridPath(cube.position, destination, blockedCellKeys)
        if (path === null || path.length === 0) return Promise.resolve()

        let resolveMovement = (): void => undefined
        const completion = new Promise<void>((resolve) => {
            resolveMovement = resolve
        })
        const reservedCellKeys = cube.occupiesCell
            ? [getGridCellKey(cube.position), ...path.map(getGridCellKey)]
            : []
        for (const cellKey of reservedCellKeys) reservedCells.set(cellKey, id)
        const segmentDuration = Math.max(0, options.duration) / path.length
        cube.movement = {
            path,
            segmentDuration,
            easing: options.easing ?? 'easeInOutCubic',
            reservedCellKeys,
            resolve: resolveMovement,
            segmentIndex: 0,
            transition: createCoordinateTransitionState(cube.position, path[0], {
                duration: segmentDuration,
                easing: options.easing,
            }),
        }
        return completion
    }

    const update = (delta: number): void => {
        if (gridTransition !== null) {
            const complete = advanceCoordinateTransition(gridTransition, delta, gridFocus)
            if (complete) {
                const completedTransition = gridTransition
                gridTransition = null
                completedTransition.resolve()
            }
        }

        for (const [cubeId, cube] of cubes) {
            let movementDelta = delta
            while (cube.movement !== null) {
                const movement = cube.movement
                const remainingDuration = Math.max(
                    0,
                    movement.transition.duration - movement.transition.elapsed
                )
                const segmentDelta = Math.min(movementDelta, remainingDuration)
                const complete = advanceCoordinateTransition(
                    movement.transition,
                    segmentDelta,
                    cube.position
                )
                if (!complete) break

                movementDelta -= segmentDelta
                movement.segmentIndex += 1
                const nextPosition = movement.path[movement.segmentIndex]
                if (nextPosition === undefined) {
                    finishCubeMovement(cubeId, cube)
                } else {
                    movement.transition = createCoordinateTransitionState(
                        cube.position,
                        nextPosition,
                        { duration: movement.segmentDuration, easing: movement.easing }
                    )
                }
                if (movementDelta <= 0 && movement.segmentDuration > 0) break
            }
        }

        if (trackedTravel !== null) {
            const trackedPosition = cubes.get(trackedTravel.cubeId)?.position
            if (trackedPosition !== undefined) {
                gridFocus.column = trackedPosition.column
                gridFocus.row = trackedPosition.row
            }
        }
    }

    return {
        addCube,
        removeCube,
        hasCube: (id) => cubes.has(id),
        getCubeRevision: () => cubeRevision,
        getCubePosition: (id) => {
            const position = cubes.get(id)?.position
            return position === undefined
                ? undefined
                : { column: position.column, row: position.row }
        },
        setCubePosition,
        setCubeOccupiesCell: (id, occupiesCell) => {
            const cube = requireCube(id)
            if (occupiesCell && !cube.occupiesCell) assertCellAvailable(cube.position, id)
            cube.occupiesCell = occupiesCell
        },
        moveCubeTo,
        getGridFocus: () => ({ column: gridFocus.column, row: gridFocus.row }),
        setGridFocus: (position) => {
            gridTransition?.resolve()
            gridTransition = null
            gridFocus.column = position.column
            gridFocus.row = position.row
        },
        moveGridFocusTo: (position, options) => {
            gridTransition?.resolve()
            const { transition, completion } = createCoordinateTransition(
                gridFocus,
                position,
                options
            )
            gridTransition = transition
            return completion
        },
        travelWithCube: async (id, position, options) => {
            const token = Symbol(id)
            trackedTravel = { cubeId: id, token }
            await moveCubeTo(id, position, options)
            if (trackedTravel?.token === token) trackedTravel = null
        },
        update,
        dispose: () => {
            if (disposed) return
            disposed = true
            trackedTravel = null
            gridTransition?.resolve()
            gridTransition = null
            for (const id of [...cubes.keys()]) removeCube(id)
        },
    }
}
