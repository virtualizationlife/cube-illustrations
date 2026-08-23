import {
    getGridDistance,
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneCubeDefinition,
    type GridSceneRuntime,
} from './gridSceneRuntime'
import { createCancellableDelay } from './createCancellableDelay'

const CARDINAL_DIRECTIONS: readonly GridCoordinate[] = [
    { column: 1, row: 0 },
    { column: -1, row: 0 },
    { column: 0, row: 1 },
    { column: 0, row: -1 },
]

export interface GridProximityOpacityConfig {
    readonly sourceCubeId?: string
    readonly targetCubeIds: readonly string[]
    readonly baseOpacity: number
    readonly fadeStartDistance: number
    readonly farDistance: number
    readonly farOpacity: number
    readonly nearDistance: number
    readonly nearOpacity: number
    readonly smoothingDuration?: number
}

export interface GridEncounterPauseConfig {
    readonly sourceCubeId?: string
    readonly targetCubeIds: readonly string[]
    readonly distance: number
    readonly duration: number
}

export interface GridRandomWalkConfig {
    readonly stepLengths: readonly number[]
    readonly encounterChance: number
    readonly maxEncounterCubes: number
    readonly encounterSpawnDistance: number
    readonly cleanupDistance: number
    readonly fullyVisibleDistance: number
    readonly visibilityDistance: number
    readonly opacitySmoothingDuration: number
    readonly encounterDistance: number
    readonly encounterPauseDuration: number
}

export type GridSceneMovementMode = 'move-grid' | 'move-cube'

export interface GridSceneAnimationController {
    readonly update: (delta: number) => void
    readonly dispose: () => void
}

export interface CreateGridSceneAnimationOptions {
    readonly runtime: GridSceneRuntime
    readonly movementMode: GridSceneMovementMode
    readonly route: readonly GridCoordinate[]
    readonly randomWalk?: GridRandomWalkConfig
    readonly additionalCubes: readonly GridSceneCubeDefinition[]
    readonly additionalCubesFactory?: () => readonly GridSceneCubeDefinition[]
    readonly proximityOpacity?: GridProximityOpacityConfig
    readonly encounterPause?: GridEncounterPauseConfig
    readonly initialDelay: number
    readonly moveDuration: number
    readonly stepPause: number
}

const interpolateSmoothly = (from: number, to: number, progress: number): number => {
    const boundedProgress = Math.min(1, Math.max(0, progress))
    const smoothProgress = boundedProgress * boundedProgress * (3 - 2 * boundedProgress)
    return from + (to - from) * smoothProgress
}

const smoothTowards = (
    current: number,
    target: number,
    delta: number,
    duration: number
): number => {
    const progress = 1 - Math.exp(-delta / Math.max(0.0001, duration))
    return current + (target - current) * progress
}

export const getProximityOpacity = (
    distance: number,
    config: GridProximityOpacityConfig
): number => {
    if (distance >= config.fadeStartDistance) return config.baseOpacity

    if (distance >= config.farDistance) {
        const fadeRange = Math.max(0.0001, config.fadeStartDistance - config.farDistance)
        return interpolateSmoothly(
            config.baseOpacity,
            config.farOpacity,
            (config.fadeStartDistance - distance) / fadeRange
        )
    }

    if (distance > config.nearDistance) {
        const nearRange = Math.max(0.0001, config.farDistance - config.nearDistance)
        return interpolateSmoothly(
            config.farOpacity,
            config.nearOpacity,
            (config.farDistance - distance) / nearRange
        )
    }

    return config.nearOpacity
}

const moveToNextCell = (
    runtime: GridSceneRuntime,
    movementMode: GridSceneMovementMode,
    position: GridCoordinate,
    duration: number
): Promise<void> => {
    const transition = { duration, easing: 'easeInOutCubic' as const }
    return movementMode === 'move-grid'
        ? runtime.travelWithCube(MAIN_CUBE_ID, position, transition)
        : runtime.moveCubeTo(MAIN_CUBE_ID, position, transition)
}

export const createGridSceneAnimation = ({
    runtime,
    movementMode,
    route,
    randomWalk,
    additionalCubes,
    additionalCubesFactory,
    proximityOpacity,
    encounterPause,
    initialDelay,
    moveDuration,
    stepPause,
}: CreateGridSceneAnimationOptions): GridSceneAnimationController => {
    let cancelled = false
    const delay = createCancellableDelay()
    let previousDirection: GridCoordinate | null = null
    let encounterCounter = 0
    let pursuedEncounterId: string | null = null
    const randomEncounterIds = new Set<string>()
    const visibleRandomEncounterIds = new Set<string>()

    const initialCubes = [...additionalCubes, ...(additionalCubesFactory?.() ?? [])]
    for (const cube of initialCubes) runtime.addCube(cube)

    const hasNearbyCube = (targetCubeIds: Iterable<string>, distance: number): boolean => {
        const sourcePosition = runtime.getCubePosition(MAIN_CUBE_ID)
        if (sourcePosition === undefined) return false
        for (const targetCubeId of targetCubeIds) {
            const targetPosition = runtime.getCubePosition(targetCubeId)
            if (
                targetPosition !== undefined &&
                getGridDistance(sourcePosition, targetPosition) <= distance
            ) {
                return true
            }
        }
        return false
    }

    const removeDistantRandomEncounters = (sourcePosition: GridCoordinate): void => {
        if (randomWalk === undefined) return
        for (const cubeId of randomEncounterIds) {
            const cubePosition = runtime.getCubePosition(cubeId)
            const distance =
                cubePosition === undefined
                    ? Number.POSITIVE_INFINITY
                    : getGridDistance(sourcePosition, cubePosition)
            const hasBeenVisible = visibleRandomEncounterIds.has(cubeId)
            if (
                cubePosition === undefined ||
                (hasBeenVisible && distance > randomWalk.cleanupDistance) ||
                (!hasBeenVisible && distance > randomWalk.encounterSpawnDistance + 1)
            ) {
                runtime.removeCube(cubeId)
                randomEncounterIds.delete(cubeId)
                visibleRandomEncounterIds.delete(cubeId)
                if (pursuedEncounterId === cubeId) pursuedEncounterId = null
            }
        }
    }

    const maybeAddRandomEncounter = (source: GridCoordinate, destination: GridCoordinate): void => {
        if (
            randomWalk === undefined ||
            randomEncounterIds.size >= randomWalk.maxEncounterCubes ||
            Math.random() >= randomWalk.encounterChance
        ) {
            return
        }

        const direction = {
            column: Math.sign(destination.column - source.column),
            row: Math.sign(destination.row - source.row),
        }
        const position = {
            column: source.column + direction.column * randomWalk.encounterSpawnDistance,
            row: source.row + direction.row * randomWalk.encounterSpawnDistance,
        }

        const id = `random-encounter-${encounterCounter}`
        encounterCounter += 1
        runtime.addCube({ id, position, opacity: 0 })
        randomEncounterIds.add(id)
        pursuedEncounterId = id
    }

    const getRandomDestination = (source: GridCoordinate): GridCoordinate => {
        if (randomWalk === undefined) return source
        const pursuedPosition =
            pursuedEncounterId === null ? undefined : runtime.getCubePosition(pursuedEncounterId)
        if (pursuedPosition !== undefined) {
            const columnDistance = pursuedPosition.column - source.column
            const rowDistance = pursuedPosition.row - source.row
            const remainingDistance = Math.abs(columnDistance) + Math.abs(rowDistance)
            if (remainingDistance > randomWalk.encounterDistance) {
                const direction = {
                    column: Math.sign(columnDistance),
                    row: Math.sign(rowDistance),
                }
                const requestedStep =
                    randomWalk.stepLengths[
                        Math.floor(Math.random() * randomWalk.stepLengths.length)
                    ] ?? 1
                const stepLength = Math.max(
                    1,
                    Math.min(requestedStep, remainingDistance - randomWalk.encounterDistance)
                )
                previousDirection = direction
                return {
                    column: source.column + direction.column * stepLength,
                    row: source.row + direction.row * stepLength,
                }
            }
            pursuedEncounterId = null
        }

        const directions = CARDINAL_DIRECTIONS.filter(
            (direction) =>
                previousDirection === null ||
                direction.column !== -previousDirection.column ||
                direction.row !== -previousDirection.row
        )
        const movementOptions = directions.flatMap((direction) =>
            randomWalk.stepLengths.map((stepLength) => ({
                direction,
                destination: {
                    column: source.column + direction.column * stepLength,
                    row: source.row + direction.row * stepLength,
                },
            }))
        )
        const availableOptions = movementOptions.filter(({ destination }) => {
            for (const cubeId of randomEncounterIds) {
                const cubePosition = runtime.getCubePosition(cubeId)
                if (
                    cubePosition?.column === destination.column &&
                    cubePosition.row === destination.row
                ) {
                    return false
                }
            }
            return true
        })
        const movement = availableOptions[Math.floor(Math.random() * availableOptions.length)]
        if (movement === undefined) return source
        previousDirection = movement.direction
        return movement.destination
    }

    const playRoute = async (): Promise<void> => {
        if (route.length === 0) return
        await delay.wait(initialDelay)

        while (!cancelled) {
            for (const position of route) {
                if (cancelled) return
                await moveToNextCell(runtime, movementMode, position, moveDuration)
                if (cancelled) return

                const sourcePosition = runtime.getCubePosition(
                    encounterPause?.sourceCubeId ?? MAIN_CUBE_ID
                )
                const hasEncounter =
                    encounterPause !== undefined &&
                    sourcePosition !== undefined &&
                    encounterPause.targetCubeIds.some((targetCubeId) => {
                        const targetPosition = runtime.getCubePosition(targetCubeId)
                        return (
                            targetPosition !== undefined &&
                            getGridDistance(sourcePosition, targetPosition) <=
                                encounterPause.distance
                        )
                    })

                await delay.wait(hasEncounter ? encounterPause.duration : stepPause)
            }
        }
    }

    const playRandomWalk = async (): Promise<void> => {
        if (randomWalk === undefined) return
        await delay.wait(initialDelay)

        while (!cancelled) {
            const sourcePosition = runtime.getCubePosition(MAIN_CUBE_ID)
            if (sourcePosition === undefined) return
            removeDistantRandomEncounters(sourcePosition)

            const destination = getRandomDestination(sourcePosition)
            maybeAddRandomEncounter(sourcePosition, destination)
            await moveToNextCell(runtime, movementMode, destination, moveDuration)
            if (cancelled) return

            const hasEncounter = hasNearbyCube(randomEncounterIds, randomWalk.encounterDistance)
            if (hasEncounter) pursuedEncounterId = null
            await delay.wait(hasEncounter ? randomWalk.encounterPauseDuration : stepPause)
        }
    }

    if (randomWalk === undefined) {
        void playRoute()
    } else {
        void playRandomWalk()
    }

    return {
        update: (delta) => {
            if (randomWalk !== undefined) {
                const sourcePosition = runtime.getCubePosition(MAIN_CUBE_ID)
                if (sourcePosition !== undefined) {
                    for (const cubeId of randomEncounterIds) {
                        const cubePosition = runtime.getCubePosition(cubeId)
                        const currentOpacity = runtime.getCubeOpacity(cubeId)
                        if (cubePosition === undefined || currentOpacity === undefined) continue
                        const distance = getGridDistance(sourcePosition, cubePosition)
                        if (distance < randomWalk.visibilityDistance) {
                            visibleRandomEncounterIds.add(cubeId)
                        }
                        const fadeRange = Math.max(
                            0.0001,
                            randomWalk.visibilityDistance - randomWalk.fullyVisibleDistance
                        )
                        const fadeProgress = (randomWalk.visibilityDistance - distance) / fadeRange
                        const targetOpacity = interpolateSmoothly(0, 1, fadeProgress)
                        runtime.setCubeOpacity(
                            cubeId,
                            smoothTowards(
                                currentOpacity,
                                targetOpacity,
                                delta,
                                randomWalk.opacitySmoothingDuration
                            )
                        )
                    }
                }
            }

            if (proximityOpacity === undefined) return
            const sourcePosition = runtime.getCubePosition(
                proximityOpacity.sourceCubeId ?? MAIN_CUBE_ID
            )
            if (sourcePosition === undefined) return

            for (const targetCubeId of proximityOpacity.targetCubeIds) {
                const targetPosition = runtime.getCubePosition(targetCubeId)
                if (targetPosition === undefined) continue
                const distance = getGridDistance(sourcePosition, targetPosition)
                const targetOpacity = getProximityOpacity(distance, proximityOpacity)
                const currentOpacity = runtime.getCubeOpacity(targetCubeId)
                if (currentOpacity === undefined) continue
                runtime.setCubeOpacity(
                    targetCubeId,
                    smoothTowards(
                        currentOpacity,
                        targetOpacity,
                        delta,
                        proximityOpacity.smoothingDuration ?? 0.3
                    )
                )
            }
        },
        dispose: () => {
            cancelled = true
            delay.cancel()
            randomEncounterIds.clear()
            visibleRandomEncounterIds.clear()
        },
    }
}
