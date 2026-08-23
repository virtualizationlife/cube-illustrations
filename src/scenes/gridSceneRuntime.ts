import type * as ThreeWebGpuNamespace from 'three/webgpu'

import {
    createCubeFaceLabels,
    type CubeFaceLabelAssets,
    type GridCubeFaceLabelInput,
} from './cubeFaceLabels'
import { createCubeGeometryCache } from './cubeGeometryCache'
import { createGridLines } from './gridLines'
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

const CUBE_COLOR = 0xfefefe
const CUBE_EDGE_COLOR = 0x8b919a
const GRID_LINE_COLOR = 0xb0b4bc
const DEFAULT_GRID_OPACITY = 0.5
const FLOOR_EPSILON_CELLS = 0.02

/** Subtle default rounding, expressed as a fraction of the cube edge. */
export const DEFAULT_CUBE_CORNER_RADIUS_RATIO = 0.02

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
    /** Corner radius in world units. Set to 0 for sharp corners. */
    readonly cornerRadius?: number
    readonly opacity?: number
    /**
     * Whether the cube reserves its grid cell. A non-occupying cube shares cells with the
     * cubes below it, which is how a lifted cube rides above ground-level ones. Defaults
     * to true.
     */
    readonly occupiesCell?: boolean
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
    /**
     * Changes whenever a cube is added or removed, so callers that derive a list from
     * `getCubes()` can cache it instead of rebuilding it every frame.
     */
    readonly getCubeRevision: () => number
    readonly getCubePosition: (id: string) => GridCoordinate | undefined
    readonly getCubeOpacity: (id: string) => number | undefined
    /** Replaces the text drawn on an existing cube's faces. */
    readonly setCubeFaceLabels: (id: string, labels: GridCubeFaceLabelInput) => void
    readonly setCubePosition: (id: string, position: GridCoordinate) => void
    /** Turns a cube's grid-cell reservation on or off after it has been created. */
    readonly setCubeOccupiesCell: (id: string, occupiesCell: boolean) => void
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
    /** Changes grid line opacity without recreating the scene. */
    readonly setGridOpacity: (opacity: number) => void
    /** Changes the radial grid fade radii, measured in grid cells. */
    readonly setGridFadeRadii: (innerRadiusCells: number, outerRadiusCells: number) => void
    /** Keeps a cube fixed in the viewport while the repeating grid moves underneath it. */
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
    readonly bodyMaterial: MeshBasicMaterial
    readonly edgeMaterial: LineBasicMaterial
    readonly faceLabels: CubeFaceLabelAssets | null
    readonly size: number
    readonly cornerRadius: number
    readonly hoverCells: number
    /** Mutated in place; `getCubePosition` hands out copies. */
    readonly position: MutableGridCoordinate
    occupiesCell: boolean
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

interface TrackedTravel {
    readonly cubeId: string
    readonly token: symbol
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
    /** Default corner radius for every cube, in world units. */
    readonly cubeCornerRadius?: number
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

const getTransitionProgress = (transition: {
    readonly elapsed: number
    readonly duration: number
}): number =>
    transition.duration === 0 ? 1 : Math.min(1, transition.elapsed / transition.duration)

/** Advances a transition and writes the interpolated value into `target`, avoiding a
 *  fresh coordinate object per cube per frame. Returns whether the transition finished. */
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

const advanceNumberTransition = (transition: NumberTransition, delta: number): number => {
    transition.elapsed += delta
    const eased = applyEasing(getTransitionProgress(transition), transition.easing)
    return transition.from + (transition.to - transition.from) * eased
}

const setMaterialTransparency = (
    material: { transparent: boolean; needsUpdate: boolean },
    transparent: boolean
): void => {
    // Changing this rebuilds the render pipeline, so only touch it on a real change.
    if (material.transparent === transparent) return
    material.transparent = transparent
    material.needsUpdate = true
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
    cubeCornerRadius,
    mainCubeFaceLabels,
}: CreateGridSceneRuntimeOptions): GridSceneRuntime => {
    const cubes = new Map<string, CubeRecord>()
    const reservedCells = new Map<string, string>()
    const geometryCache = createCubeGeometryCache(THREE)
    const grid = new THREE.Group()
    let maxGridOpacity = clampOpacity(gridOpacity)
    const gridLines = createGridLines({
        THREE,
        gridCellSize,
        gridCellCount,
        color: GRID_LINE_COLOR,
        opacity: maxGridOpacity,
        fadeInnerRadius: Math.max(0, gridFadeInnerRadiusCells ?? 0) * gridCellSize,
        fadeOuterRadius: Math.max(0, gridFadeOuterRadiusCells ?? 0) * gridCellSize,
    })
    grid.add(gridLines.object)
    scene.add(grid)

    const gridFocus: MutableGridCoordinate = { column: 0, row: 0 }
    let gridTransition: CoordinateTransition | null = null
    let trackedTravel: TrackedTravel | null = null
    let cubeRevision = 0
    let disposed = false

    const setVisualOpacity = (cube: CubeRecord, opacity: number): void => {
        const nextOpacity = clampOpacity(opacity)
        cube.opacity = nextOpacity
        cube.object.visible = nextOpacity > 0
        cube.bodyMaterial.opacity = nextOpacity
        cube.edgeMaterial.opacity = nextOpacity
        // A fully opaque cube renders identically through the opaque path, which skips
        // blending and the per-frame back-to-front sort. Labels keep their glyph alpha.
        const isTransparent = nextOpacity < 1
        setMaterialTransparency(cube.bodyMaterial, isTransparent)
        setMaterialTransparency(cube.edgeMaterial, isTransparent)
        cube.faceLabels?.setOpacity(nextOpacity)
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
        gridLines.setOffset(-columnFraction * gridCellSize, -rowFraction * gridCellSize)
    }

    const applyPositions = (): void => {
        updateGridVisual()
        for (const cube of cubes.values()) positionCube(cube)
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

    const addCube = (definition: GridSceneCubeDefinition): Object3D => {
        if (disposed) throw new Error('Cannot add a cube to a disposed grid scene')
        if (cubes.has(definition.id)) {
            throw new Error(`A cube with id "${definition.id}" already exists`)
        }
        const initialPosition = normalizeGridCoordinate(definition.position ?? { column: 0, row: 0 })
        const occupiesCell = definition.occupiesCell ?? true
        if (occupiesCell) assertCellAvailable(initialPosition)

        const size = definition.size ?? mainCubeSize
        const requestedCornerRadius =
            definition.cornerRadius ??
            cubeCornerRadius ??
            size * DEFAULT_CUBE_CORNER_RADIUS_RATIO
        const cornerRadius = Math.min(size / 2, Math.max(0, requestedCornerRadius))
        const geometrySet = geometryCache.acquire(size, cornerRadius)

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
        const body = new THREE.Mesh(geometrySet.body, bodyMaterial)
        body.renderOrder = 1
        // Lets a hover raycast resolve a hit straight to its cube instead of walking the
        // scene graph and searching the cube list at every level.
        body.userData.cubeId = definition.id
        body.userData.cubeObject = object
        object.add(body)

        const edges = new THREE.LineSegments(geometrySet.edges, edgeMaterial)
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
            bodyMaterial,
            edgeMaterial,
            faceLabels,
            size,
            cornerRadius,
            hoverCells: definition.hoverCells ?? 0,
            position: { column: initialPosition.column, row: initialPosition.row },
            occupiesCell,
            opacity: definition.opacity ?? 1,
            movement: null,
            opacityTransition: null,
        }
        cubes.set(definition.id, cube)
        cubeRevision += 1
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
        geometryCache.release(cube.size, cube.cornerRadius)
        cube.bodyMaterial.dispose()
        cube.edgeMaterial.dispose()
        cube.faceLabels?.dispose()
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
        const blockedCellKeys = cube.occupiesCell ? getBlockedCellKeys(id) : new Set<string>()
        const path = findGridPath(cube.position, destination, blockedCellKeys)
        if (path === null || path.length === 0) return Promise.resolve()

        let resolveMovement = (): void => undefined
        const completion = new Promise<void>((resolve) => {
            resolveMovement = resolve
        })
        // Keep the starting cell reserved as well. Otherwise another cube could enter it
        // while this cube is still crossing the first cell boundary.
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
        gridFocus.column = position.column
        gridFocus.row = position.row
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
                        {
                            duration: movement.segmentDuration,
                            easing: movement.easing,
                        }
                    )
                }

                if (movementDelta <= 0 && movement.segmentDuration > 0) break
            }

            if (cube.opacityTransition !== null) {
                const value = advanceNumberTransition(cube.opacityTransition, delta)
                setVisualOpacity(cube, value)
                if (getTransitionProgress(cube.opacityTransition) >= 1) {
                    const completedTransition = cube.opacityTransition
                    cube.opacityTransition = null
                    completedTransition.resolve()
                }
            }
        }

        if (trackedTravel !== null) {
            const trackedPosition = cubes.get(trackedTravel.cubeId)?.position
            if (trackedPosition !== undefined) {
                gridFocus.column = trackedPosition.column
                gridFocus.row = trackedPosition.row
            }
        }

        // Unconditional on purpose. Scenes write to a cube's object transform themselves and
        // rely on this pass to restore it from the grid coordinates every frame — the flip
        // lift in FaceFlipCubeScene does `mesh.position.y += ...` and would otherwise
        // accumulate forever. Skipping it when no transition is running is not safe.
        applyPositions()
    }

    const mainCube = addCube({
        id: MAIN_CUBE_ID,
        size: mainCubeSize,
        hoverCells: mainCubeHoverCells,
        faceLabels: mainCubeFaceLabels,
    })
    updateGridVisual()

    return {
        grid,
        mainCube,
        addCube,
        removeCube,
        hasCube: (id) => cubes.has(id),
        getCube: (id) => cubes.get(id)?.object,
        getCubes: () => [...cubes.entries()].map(([id, cube]) => ({ id, object: cube.object })),
        getCubeRevision: () => cubeRevision,
        getCubePosition: (id) => {
            const position = cubes.get(id)?.position
            return position === undefined
                ? undefined
                : { column: position.column, row: position.row }
        },
        getCubeOpacity: (id) => cubes.get(id)?.opacity,
        setCubeFaceLabels: (id, labels) => {
            requireCube(id).faceLabels?.setLabels(labels)
        },
        setCubePosition,
        setCubeOccupiesCell: (id, occupiesCell) => {
            const cube = requireCube(id)
            if (occupiesCell && !cube.occupiesCell) assertCellAvailable(cube.position, id)
            cube.occupiesCell = occupiesCell
        },
        moveCubeTo,
        setCubeOpacity,
        fadeCubeTo,
        getGridFocus: () => ({ column: gridFocus.column, row: gridFocus.row }),
        setGridFocus,
        moveGridFocusTo,
        setGridOpacity: (opacity) => {
            maxGridOpacity = clampOpacity(opacity)
            gridLines.setOpacity(maxGridOpacity)
        },
        setGridFadeRadii: (innerRadiusCells, outerRadiusCells) => {
            gridLines.setFadeRadii(
                Math.max(0, innerRadiusCells) * gridCellSize,
                Math.max(0, outerRadiusCells) * gridCellSize
            )
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
            scene.remove(grid)
            gridLines.dispose()
            geometryCache.dispose()
        },
    }
}
