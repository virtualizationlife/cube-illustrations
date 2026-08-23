import type * as ThreeWebGpuNamespace from 'three/webgpu'

import {
    createCubeFaceLabels,
    type CubeFaceLabelAssets,
    type GridCubeFaceLabelInput,
} from './cubeFaceLabels'
import {
    findGridPath,
    getGridCellKey,
    normalizeGridCoordinate,
    type GridCoordinate,
} from './gridPathfinding'

export type { GridCoordinate } from './gridPathfinding'

type Object3D = InstanceType<typeof ThreeWebGpuNamespace.Object3D>
type Scene = InstanceType<typeof ThreeWebGpuNamespace.Scene>
type MeshBasicMaterial = InstanceType<typeof ThreeWebGpuNamespace.MeshBasicMaterial>
type LineBasicMaterial = InstanceType<typeof ThreeWebGpuNamespace.LineBasicMaterial>
type BufferAttribute = InstanceType<typeof ThreeWebGpuNamespace.BufferAttribute>

const CUBE_COLOR = 0xfefefe
const CUBE_EDGE_COLOR = 0x8b919a
const GRID_LINE_COLOR = 0xb0b4bc
const DEFAULT_GRID_OPACITY = 0.5
const FLOOR_EPSILON_CELLS = 0.02
const GRID_SEGMENTS_PER_CELL = 6

export const MAIN_CUBE_ID = 'main'

export type GridSceneEasing = 'linear' | 'easeInOutCubic' | 'easeOutCubic'

export interface GridSceneTransitionOptions {
    /** Animation duration in seconds. */
    readonly duration: number
    readonly easing?: GridSceneEasing
}

export interface GridSceneCubeDefinition {
    readonly id: string
    readonly position?: GridCoordinate
    /** Cube edge in world units. Defaults to the main cube edge. */
    readonly size?: number
    /** Vertical distance from the grid in grid-cell units. */
    readonly hoverCells?: number
    readonly opacity?: number
    /** One label for every face, or individual labels. Each label is limited to 3 symbols. */
    readonly faceLabels?: GridCubeFaceLabelInput
}

export interface GridSceneCubeEntry {
    readonly id: string
    readonly object: Object3D
}

export interface GridSceneRuntime {
    /** The repeating grid visual. Moving focus makes the grid slide under the cubes. */
    readonly grid: Object3D
    readonly mainCube: Object3D
    readonly addCube: (definition: GridSceneCubeDefinition) => Object3D
    readonly removeCube: (id: string) => void
    readonly hasCube: (id: string) => boolean
    readonly getCube: (id: string) => Object3D | undefined
    readonly getCubes: () => readonly GridSceneCubeEntry[]
    readonly getCubePosition: (id: string) => GridCoordinate | undefined
    readonly getCubeOpacity: (id: string) => number | undefined
    readonly setCubePosition: (id: string, position: GridCoordinate) => void
    readonly moveCubeTo: (
        id: string,
        position: GridCoordinate,
        options: GridSceneTransitionOptions
    ) => Promise<void>
    readonly setCubeOpacity: (id: string, opacity: number) => void
    readonly fadeCubeTo: (
        id: string,
        opacity: number,
        options: GridSceneTransitionOptions
    ) => Promise<void>
    readonly getGridFocus: () => GridCoordinate
    readonly setGridFocus: (position: GridCoordinate) => void
    readonly moveGridFocusTo: (
        position: GridCoordinate,
        options: GridSceneTransitionOptions
    ) => Promise<void>
    /** Keeps a cube fixed in the viewport while the repeating grid moves underneath it. */
    readonly travelWithCube: (
        id: string,
        position: GridCoordinate,
        options: GridSceneTransitionOptions
    ) => Promise<void>
    readonly update: (delta: number) => void
    readonly dispose: () => void
}

interface CoordinateTransition {
    elapsed: number
    readonly duration: number
    readonly easing: GridSceneEasing
    readonly from: GridCoordinate
    readonly to: GridCoordinate
    readonly resolve: () => void
}

interface NumberTransition {
    elapsed: number
    readonly duration: number
    readonly easing: GridSceneEasing
    readonly from: number
    readonly to: number
    readonly resolve: () => void
}

interface CubeRecord {
    readonly object: Object3D
    readonly geometry: { dispose: () => void }
    readonly bodyMaterial: MeshBasicMaterial
    readonly edgeMaterial: LineBasicMaterial
    readonly edgesGeometry: { dispose: () => void }
    readonly faceLabels: CubeFaceLabelAssets | null
    readonly size: number
    readonly hoverCells: number
    position: GridCoordinate
    opacity: number
    movement: CubeMovement | null
    opacityTransition: NumberTransition | null
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

interface GridLineRecord {
    readonly object: Object3D
    readonly material: LineBasicMaterial
    readonly geometry: { dispose: () => void }
    readonly colorAttribute: BufferAttribute
    readonly parallelPositions: readonly number[]
    readonly basePosition: number
    readonly direction: 'column' | 'row'
}

export interface CreateGridSceneRuntimeOptions {
    readonly scene: Scene
    readonly THREE: typeof ThreeWebGpuNamespace
    readonly gridCellSize: number
    readonly gridCellCount: number
    readonly gridOpacity?: number
    readonly gridFadeInnerRadiusCells?: number
    readonly gridFadeOuterRadiusCells?: number
    readonly mainCubeSize: number
    readonly mainCubeHoverCells: number
    readonly mainCubeFaceLabels?: GridCubeFaceLabelInput
}

const clampOpacity = (opacity: number): number => Math.min(1, Math.max(0, opacity))

/** Euclidean distance measured in grid cells; useful for proximity-based opacity. */
export const getGridDistance = (from: GridCoordinate, to: GridCoordinate): number =>
    Math.hypot(to.column - from.column, to.row - from.row)

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

const interpolateCoordinate = (
    from: GridCoordinate,
    to: GridCoordinate,
    progress: number
): GridCoordinate => ({
    column: from.column + (to.column - from.column) * progress,
    row: from.row + (to.row - from.row) * progress,
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

const createCoordinateTransitionState = (
    from: GridCoordinate,
    to: GridCoordinate,
    options: GridSceneTransitionOptions,
    resolve = (): void => undefined
): CoordinateTransition => ({
    elapsed: 0,
    duration: Math.max(0, options.duration),
    easing: options.easing ?? 'easeInOutCubic',
    from: { ...from },
    to: { ...to },
    resolve,
})

const createNumberTransition = (
    from: number,
    to: number,
    options: GridSceneTransitionOptions
): { readonly transition: NumberTransition; readonly completion: Promise<void> } => {
    let resolveTransition = (): void => undefined
    const completion = new Promise<void>((resolve) => {
        resolveTransition = resolve
    })

    return {
        transition: {
            elapsed: 0,
            duration: Math.max(0, options.duration),
            easing: options.easing ?? 'easeInOutCubic',
            from,
            to,
            resolve: resolveTransition,
        },
        completion,
    }
}

export const createGridSceneRuntime = ({
    scene,
    THREE,
    gridCellSize,
    gridCellCount,
    gridOpacity = DEFAULT_GRID_OPACITY,
    gridFadeInnerRadiusCells,
    gridFadeOuterRadiusCells,
    mainCubeSize,
    mainCubeHoverCells,
    mainCubeFaceLabels,
}: CreateGridSceneRuntimeOptions): GridSceneRuntime => {
    const cubes = new Map<string, CubeRecord>()
    const reservedCells = new Map<string, string>()
    const grid = new THREE.Group()
    const gridLines: GridLineRecord[] = []
    const halfGridSize = (gridCellSize * gridCellCount) / 2
    const maxGridOpacity = clampOpacity(gridOpacity)
    const radialFadeInnerRadius = Math.max(0, gridFadeInnerRadiusCells ?? 0) * gridCellSize
    const radialFadeOuterRadius = Math.max(0, gridFadeOuterRadiusCells ?? 0) * gridCellSize
    const hasRadialFade = radialFadeOuterRadius > radialFadeInnerRadius
    let gridFocus: GridCoordinate = { column: 0, row: 0 }
    let gridTransition: CoordinateTransition | null = null
    let trackedTravelCubeId: string | null = null
    let disposed = false

    const setVisualOpacity = (cube: CubeRecord, opacity: number): void => {
        const nextOpacity = clampOpacity(opacity)
        cube.opacity = nextOpacity
        cube.object.visible = nextOpacity > 0
        cube.bodyMaterial.opacity = nextOpacity
        cube.edgeMaterial.opacity = nextOpacity
        for (const material of cube.faceLabels?.materials ?? []) material.opacity = nextOpacity
    }

    const positionCube = (cube: CubeRecord): void => {
        const floorEpsilon = gridCellSize * FLOOR_EPSILON_CELLS
        cube.object.position.set(
            (cube.position.column - gridFocus.column) * gridCellSize,
            cube.hoverCells * gridCellSize + cube.size / 2 + floorEpsilon,
            (cube.position.row - gridFocus.row) * gridCellSize
        )
    }

    const updateGridVisual = (): void => {
        // Only the fractional part matters for an infinite repeating grid.
        const columnFraction = gridFocus.column - Math.floor(gridFocus.column)
        const rowFraction = gridFocus.row - Math.floor(gridFocus.row)
        const columnOffset = -columnFraction * gridCellSize
        const rowOffset = -rowFraction * gridCellSize

        const getEdgeFade = (position: number): number =>
            Math.min(
                1,
                Math.max(0, (halfGridSize + gridCellSize - Math.abs(position)) / gridCellSize)
            )

        const getRadialFade = (column: number, row: number): number => {
            if (!hasRadialFade) return 1
            const distance = Math.hypot(column, row)
            const progress = Math.min(
                1,
                Math.max(
                    0,
                    (distance - radialFadeInnerRadius) /
                        (radialFadeOuterRadius - radialFadeInnerRadius)
                )
            )
            const smoothProgress = progress * progress * (3 - 2 * progress)
            return 1 - smoothProgress
        }

        for (const line of gridLines) {
            const perpendicularPosition =
                line.direction === 'column'
                    ? line.basePosition + columnOffset
                    : line.basePosition + rowOffset
            const parallelOffset = line.direction === 'column' ? rowOffset : columnOffset
            let lineIsVisible = false

            for (let index = 0; index < line.parallelPositions.length; index += 1) {
                const parallelPosition = line.parallelPositions[index] + parallelOffset
                const column =
                    line.direction === 'column' ? perpendicularPosition : parallelPosition
                const row = line.direction === 'row' ? perpendicularPosition : parallelPosition
                const alpha = getEdgeFade(column) * getEdgeFade(row) * getRadialFade(column, row)
                line.colorAttribute.setW(index, alpha)
                if (alpha > 0) lineIsVisible = true
            }

            line.colorAttribute.needsUpdate = true
            line.object.visible = lineIsVisible
            line.object.position.set(
                line.direction === 'column' ? perpendicularPosition : columnOffset,
                0,
                line.direction === 'row' ? perpendicularPosition : rowOffset
            )
        }
    }

    const applyPositions = (): void => {
        updateGridVisual()
        for (const cube of cubes.values()) positionCube(cube)
    }

    const addGridLine = (direction: GridLineRecord['direction'], basePosition: number): void => {
        const geometry = new THREE.BufferGeometry()
        const positions: number[] = []
        const colors: number[] = []
        const parallelPositions: number[] = []
        const parallelStart = -halfGridSize - gridCellSize
        const segmentLength = gridCellSize / GRID_SEGMENTS_PER_CELL
        const segmentCount = (gridCellCount + 2) * GRID_SEGMENTS_PER_CELL

        for (let index = 0; index < segmentCount; index += 1) {
            const start = parallelStart + index * segmentLength
            const end = start + segmentLength
            if (direction === 'column') {
                positions.push(0, 0, start, 0, 0, end)
            } else {
                positions.push(start, 0, 0, end, 0, 0)
            }
            parallelPositions.push(start, end)
            // RGB stays white so only vertex alpha modulates the material's grid color.
            colors.push(1, 1, 1, 1)
            colors.push(1, 1, 1, 1)
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        const colorAttribute = new THREE.Float32BufferAttribute(colors, 4)
        geometry.setAttribute('color', colorAttribute)

        const material = new THREE.LineBasicMaterial({
            color: GRID_LINE_COLOR,
            transparent: true,
            opacity: maxGridOpacity,
            depthWrite: false,
            vertexColors: true,
        })
        const object = new THREE.LineSegments(geometry, material)
        object.renderOrder = 0
        grid.add(object)
        gridLines.push({
            object,
            material,
            geometry,
            colorAttribute,
            parallelPositions,
            basePosition,
            direction,
        })
    }

    // One extra line on either side cross-fades when the repeating grid moves a cell.
    for (let index = -1; index <= gridCellCount + 1; index += 1) {
        const basePosition = (-gridCellCount / 2 + index) * gridCellSize
        addGridLine('column', basePosition)
        addGridLine('row', basePosition)
    }
    scene.add(grid)

    const getBlockedCellKeys = (excludedCubeId?: string): Set<string> => {
        const blocked = new Set<string>()
        for (const [cubeId, cube] of cubes) {
            if (cubeId !== excludedCubeId) blocked.add(getGridCellKey(cube.position))
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

    const addCube = (definition: GridSceneCubeDefinition): Object3D => {
        if (disposed) throw new Error('Cannot add a cube to a disposed grid scene')
        if (cubes.has(definition.id)) {
            throw new Error(`A cube with id "${definition.id}" already exists`)
        }
        const initialPosition = normalizeGridCoordinate(definition.position ?? { column: 0, row: 0 })
        assertCellAvailable(initialPosition)

        const size = definition.size ?? mainCubeSize
        const geometry = new THREE.BoxGeometry(size, size, size)
        const edgesGeometry = new THREE.EdgesGeometry(geometry)
        const bodyMaterial = new THREE.MeshBasicMaterial({
            color: CUBE_COLOR,
            transparent: true,
            opacity: clampOpacity(definition.opacity ?? 1),
            depthWrite: true,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
            side: THREE.FrontSide,
        })
        const edgeMaterial = new THREE.LineBasicMaterial({
            color: CUBE_EDGE_COLOR,
            transparent: true,
            opacity: 1,
            depthTest: true,
        })

        const object = new THREE.Group()
        const body = new THREE.Mesh(geometry, bodyMaterial)
        body.renderOrder = 1
        object.add(body)

        const edges = new THREE.LineSegments(edgesGeometry, edgeMaterial)
        edges.scale.setScalar(1.01)
        edges.renderOrder = 3
        object.add(edges)

        const faceLabels =
            definition.faceLabels === undefined
                ? null
                : createCubeFaceLabels({
                      THREE,
                      size,
                      labels: definition.faceLabels,
                      opacity: clampOpacity(definition.opacity ?? 1),
                  })
        if (faceLabels !== null) object.add(faceLabels.object)

        const cube: CubeRecord = {
            object,
            geometry,
            bodyMaterial,
            edgeMaterial,
            edgesGeometry,
            faceLabels,
            size,
            hoverCells: definition.hoverCells ?? 0,
            position: initialPosition,
            opacity: definition.opacity ?? 1,
            movement: null,
            opacityTransition: null,
        }
        cubes.set(definition.id, cube)
        scene.add(object)
        setVisualOpacity(cube, cube.opacity)
        positionCube(cube)
        return object
    }

    const requireCube = (id: string): CubeRecord => {
        const cube = cubes.get(id)
        if (cube === undefined) throw new Error(`Unknown cube id "${id}"`)
        return cube
    }

    const releaseMovementReservations = (cubeId: string, movement: CubeMovement): void => {
        for (const cellKey of movement.reservedCellKeys) {
            if (reservedCells.get(cellKey) === cubeId) reservedCells.delete(cellKey)
        }
    }

    const finishCubeMovement = (cubeId: string, cube: CubeRecord): void => {
        const movement = cube.movement
        if (movement === null) return
        cube.movement = null
        releaseMovementReservations(cubeId, movement)
        movement.resolve()
    }

    const removeCube = (id: string): void => {
        const cube = cubes.get(id)
        if (cube === undefined) return

        finishCubeMovement(id, cube)
        cube.opacityTransition?.resolve()
        scene.remove(cube.object)
        cube.geometry.dispose()
        cube.edgesGeometry.dispose()
        cube.bodyMaterial.dispose()
        cube.edgeMaterial.dispose()
        cube.faceLabels?.dispose()
        cubes.delete(id)
    }

    const setCubePosition = (id: string, position: GridCoordinate): void => {
        const cube = requireCube(id)
        const normalizedPosition = normalizeGridCoordinate(position)
        assertCellAvailable(normalizedPosition, id)
        finishCubeMovement(id, cube)
        cube.position = normalizedPosition
        positionCube(cube)
    }

    const moveCubeTo = (
        id: string,
        position: GridCoordinate,
        options: GridSceneTransitionOptions
    ): Promise<void> => {
        const cube = requireCube(id)
        finishCubeMovement(id, cube)
        const destination = normalizeGridCoordinate(position)
        const path = findGridPath(cube.position, destination, getBlockedCellKeys(id))
        if (path === null || path.length === 0) return Promise.resolve()

        let resolveMovement = (): void => undefined
        const completion = new Promise<void>((resolve) => {
            resolveMovement = resolve
        })
        // Keep the starting cell reserved as well. Otherwise another cube could enter it
        // while this cube is still crossing the first cell boundary.
        const reservedCellKeys = [getGridCellKey(cube.position), ...path.map(getGridCellKey)]
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

    const setCubeOpacity = (id: string, opacity: number): void => {
        const cube = requireCube(id)
        cube.opacityTransition?.resolve()
        cube.opacityTransition = null
        setVisualOpacity(cube, opacity)
    }

    const fadeCubeTo = (
        id: string,
        opacity: number,
        options: GridSceneTransitionOptions
    ): Promise<void> => {
        const cube = requireCube(id)
        cube.opacityTransition?.resolve()
        const { transition, completion } = createNumberTransition(
            cube.opacity,
            clampOpacity(opacity),
            options
        )
        cube.opacityTransition = transition
        return completion
    }

    const setGridFocus = (position: GridCoordinate): void => {
        gridTransition?.resolve()
        gridTransition = null
        gridFocus = { ...position }
        applyPositions()
    }

    const moveGridFocusTo = (
        position: GridCoordinate,
        options: GridSceneTransitionOptions
    ): Promise<void> => {
        gridTransition?.resolve()
        const { transition, completion } = createCoordinateTransition(gridFocus, position, options)
        gridTransition = transition
        return completion
    }

    const updateCoordinateTransition = (
        transition: CoordinateTransition,
        delta: number
    ): { readonly value: GridCoordinate; readonly complete: boolean } => {
        transition.elapsed += delta
        const progress =
            transition.duration === 0 ? 1 : Math.min(1, transition.elapsed / transition.duration)
        return {
            value: interpolateCoordinate(
                transition.from,
                transition.to,
                applyEasing(progress, transition.easing)
            ),
            complete: progress >= 1,
        }
    }

    const updateNumberTransition = (
        transition: NumberTransition,
        delta: number
    ): { readonly value: number; readonly complete: boolean } => {
        transition.elapsed += delta
        const progress =
            transition.duration === 0 ? 1 : Math.min(1, transition.elapsed / transition.duration)
        const eased = applyEasing(progress, transition.easing)
        return {
            value: transition.from + (transition.to - transition.from) * eased,
            complete: progress >= 1,
        }
    }

    const update = (delta: number): void => {
        if (gridTransition !== null) {
            const result = updateCoordinateTransition(gridTransition, delta)
            gridFocus = result.value
            if (result.complete) {
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
                const result = updateCoordinateTransition(movement.transition, segmentDelta)
                cube.position = result.value
                if (!result.complete) break

                movementDelta -= segmentDelta
                movement.segmentIndex += 1
                const nextPosition = movement.path[movement.segmentIndex]
                if (nextPosition === undefined) {
                    finishCubeMovement(cubeId, cube)
                } else {
                    movement.transition = createCoordinateTransitionState(
                        cube.position,
                        nextPosition,
                        {
                            duration: movement.segmentDuration,
                            easing: movement.easing,
                        }
                    )
                }

                if (movementDelta <= 0 && movement.segmentDuration > 0) break
            }

            if (cube.opacityTransition !== null) {
                const result = updateNumberTransition(cube.opacityTransition, delta)
                setVisualOpacity(cube, result.value)
                if (result.complete) {
                    const completedTransition = cube.opacityTransition
                    cube.opacityTransition = null
                    completedTransition.resolve()
                }
            }
        }

        if (trackedTravelCubeId !== null) {
            const trackedPosition = cubes.get(trackedTravelCubeId)?.position
            if (trackedPosition !== undefined) gridFocus = { ...trackedPosition }
        }

        applyPositions()
    }

    const mainCube = addCube({
        id: MAIN_CUBE_ID,
        size: mainCubeSize,
        hoverCells: mainCubeHoverCells,
        faceLabels: mainCubeFaceLabels,
    })

    return {
        grid,
        mainCube,
        addCube,
        removeCube,
        hasCube: (id) => cubes.has(id),
        getCube: (id) => cubes.get(id)?.object,
        getCubes: () => [...cubes.entries()].map(([id, cube]) => ({ id, object: cube.object })),
        getCubePosition: (id) => {
            const position = cubes.get(id)?.position
            return position === undefined ? undefined : { ...position }
        },
        getCubeOpacity: (id) => cubes.get(id)?.opacity,
        setCubePosition,
        moveCubeTo,
        setCubeOpacity,
        fadeCubeTo,
        getGridFocus: () => ({ ...gridFocus }),
        setGridFocus,
        moveGridFocusTo,
        travelWithCube: async (id, position, options) => {
            trackedTravelCubeId = id
            await moveCubeTo(id, position, options)
            if (trackedTravelCubeId === id) trackedTravelCubeId = null
        },
        update,
        dispose: () => {
            if (disposed) return
            disposed = true
            trackedTravelCubeId = null
            gridTransition?.resolve()
            gridTransition = null
            for (const id of [...cubes.keys()]) removeCube(id)
            scene.remove(grid)
            for (const line of gridLines) {
                line.geometry.dispose()
                line.material.dispose()
            }
            gridLines.length = 0
        },
    }
}
