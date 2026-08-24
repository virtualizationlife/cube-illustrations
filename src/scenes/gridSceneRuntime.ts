import type * as ThreeWebGpuNamespace from 'three/webgpu'

import {
    createCubeFaceLabels,
    type CubeFaceLabelAssets,
    type GridCubeFaceLabelInput,
} from './cubeFaceLabels'
import { createCubeGeometryCache } from './cubeGeometryCache'
import { createGridLines } from './gridLines'
import {
    createGridWorld,
    type GridCoordinate,
    type GridSceneEasing,
    type GridSceneTransitionOptions,
} from './gridWorld'

export type { GridCoordinate, GridSceneEasing, GridSceneTransitionOptions } from './gridWorld'

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

export type GridSceneCubeDefinition = {
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

export type GridSceneCubeEntry = {
    readonly id: string
    readonly object: Object3D
}

export type GridSceneRuntime = {
    /** The repeating grid visual. Moving focus makes the grid slide under the cubes. */
    readonly grid: Object3D
    readonly mainCube: Object3D
    readonly addCube: (definition: GridSceneCubeDefinition) => Object3D
    readonly removeCube: (id: string) => void
    readonly hasCube: (id: string) => boolean
    readonly getCube: (id: string) => Object3D | undefined
    readonly getCubes: () => readonly GridSceneCubeEntry[]
    readonly getCubeRevision: () => number
    readonly getCubePosition: (id: string) => GridCoordinate | undefined
    readonly getCubeOpacity: (id: string) => number | undefined
    /** Passing `undefined` removes the labels; passing labels adds them if absent. */
    readonly setCubeFaceLabels: (id: string, labels: GridCubeFaceLabelInput | undefined) => void
    readonly setCubePosition: (id: string, position: GridCoordinate) => void
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
    readonly setGridOpacity: (opacity: number) => void
    readonly setGridFadeRadii: (innerRadiusCells: number, outerRadiusCells: number) => void
    readonly travelWithCube: (
        id: string,
        position: GridCoordinate,
        options: GridSceneTransitionOptions
    ) => Promise<void>
    readonly update: (delta: number) => void
    readonly dispose: () => void
}

type NumberTransition = {
    elapsed: number
    readonly duration: number
    readonly easing: GridSceneEasing
    readonly from: number
    readonly to: number
    readonly resolve: () => void
}

type CubeRecord = {
    readonly id: string
    readonly object: Object3D
    readonly bodyMaterial: MeshBasicMaterial
    readonly edgeMaterial: LineBasicMaterial
    faceLabels: CubeFaceLabelAssets | null
    readonly size: number
    readonly cornerRadius: number
    readonly hoverCells: number
    opacity: number
    opacityTransition: NumberTransition | null
}

export type CreateGridSceneRuntimeOptions = {
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

const advanceNumberTransition = (transition: NumberTransition, delta: number): number => {
    transition.elapsed += delta
    const eased = applyEasing(getTransitionProgress(transition), transition.easing)
    return transition.from + (transition.to - transition.from) * eased
}

const setMaterialTransparency = (
    material: { transparent: boolean; needsUpdate: boolean },
    transparent: boolean
): void => {
    if (material.transparent === transparent) return
    material.transparent = transparent
    material.needsUpdate = true
}

/** Three/WebGPU view adapter over the pure GridWorld state model. */
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
    const world = createGridWorld()
    const cubes = new Map<string, CubeRecord>()
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
    let disposed = false

    const requireCube = (id: string): CubeRecord => {
        const cube = cubes.get(id)
        if (cube === undefined) throw new Error(`Unknown cube id "${id}"`)
        return cube
    }

    const setVisualOpacity = (cube: CubeRecord, opacity: number): void => {
        const nextOpacity = clampOpacity(opacity)
        cube.opacity = nextOpacity
        cube.object.visible = nextOpacity > 0
        cube.bodyMaterial.opacity = nextOpacity
        cube.edgeMaterial.opacity = nextOpacity
        const isTransparent = nextOpacity < 1
        setMaterialTransparency(cube.bodyMaterial, isTransparent)
        setMaterialTransparency(cube.edgeMaterial, isTransparent)
        cube.faceLabels?.setOpacity(nextOpacity)
    }

    const positionCube = (cube: CubeRecord, focus = world.getGridFocus()): void => {
        const position = world.getCubePosition(cube.id)
        if (position === undefined) return
        const floorEpsilon = gridCellSize * FLOOR_EPSILON_CELLS
        cube.object.position.set(
            (position.column - focus.column) * gridCellSize,
            cube.hoverCells * gridCellSize + cube.size / 2 + floorEpsilon,
            (position.row - focus.row) * gridCellSize
        )
    }

    const updateGridVisual = (focus = world.getGridFocus()): void => {
        const columnFraction = focus.column - Math.floor(focus.column)
        const rowFraction = focus.row - Math.floor(focus.row)
        gridLines.setOffset(-columnFraction * gridCellSize, -rowFraction * gridCellSize)
    }

    const applyPositions = (): void => {
        const focus = world.getGridFocus()
        updateGridVisual(focus)
        for (const cube of cubes.values()) positionCube(cube, focus)
    }

    const addCube = (definition: GridSceneCubeDefinition): Object3D => {
        if (disposed) throw new Error('Cannot add a cube to a disposed grid scene')
        world.addCube({
            id: definition.id,
            position: definition.position,
            occupiesCell: definition.occupiesCell,
        })

        const size = definition.size ?? mainCubeSize
        const requestedCornerRadius =
            definition.cornerRadius ?? cubeCornerRadius ?? size * DEFAULT_CUBE_CORNER_RADIUS_RATIO
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
            id: definition.id,
            object,
            bodyMaterial,
            edgeMaterial,
            faceLabels,
            size,
            cornerRadius,
            hoverCells: definition.hoverCells ?? 0,
            opacity: definition.opacity ?? 1,
            opacityTransition: null,
        }
        cubes.set(definition.id, cube)
        scene.add(object)
        setVisualOpacity(cube, cube.opacity)
        positionCube(cube)
        return object
    }

    const removeCube = (id: string): void => {
        const cube = cubes.get(id)
        if (cube === undefined) return

        world.removeCube(id)
        cube.opacityTransition?.resolve()
        scene.remove(cube.object)
        geometryCache.release(cube.size, cube.cornerRadius)
        cube.bodyMaterial.dispose()
        cube.edgeMaterial.dispose()
        cube.faceLabels?.dispose()
        cubes.delete(id)
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

    const update = (delta: number): void => {
        world.update(delta)
        for (const cube of cubes.values()) {
            if (cube.opacityTransition === null) continue
            const value = advanceNumberTransition(cube.opacityTransition, delta)
            setVisualOpacity(cube, value)
            if (getTransitionProgress(cube.opacityTransition) >= 1) {
                const completedTransition = cube.opacityTransition
                cube.opacityTransition = null
                completedTransition.resolve()
            }
        }

        // Unconditional: scenes may temporarily write transforms on top of grid positions.
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
        hasCube: world.hasCube,
        getCube: (id) => cubes.get(id)?.object,
        getCubes: () => [...cubes.entries()].map(([id, cube]) => ({ id, object: cube.object })),
        getCubeRevision: world.getCubeRevision,
        getCubePosition: world.getCubePosition,
        getCubeOpacity: (id) => cubes.get(id)?.opacity,
        setCubeFaceLabels: (id, labels) => {
            const cube = requireCube(id)

            if (labels === undefined) {
                if (cube.faceLabels === null) return
                cube.object.remove(cube.faceLabels.object)
                cube.faceLabels.dispose()
                cube.faceLabels = null
                return
            }

            if (cube.faceLabels === null) {
                // The cube was built without labels, so its assets have to be created now.
                const created = createCubeFaceLabels({
                    THREE,
                    size: cube.size,
                    labels,
                    opacity: cube.opacity,
                })
                cube.object.add(created.object)
                cube.faceLabels = created
                return
            }

            cube.faceLabels.setLabels(labels)
        },
        setCubePosition: (id, position) => {
            world.setCubePosition(id, position)
            positionCube(requireCube(id))
        },
        setCubeOccupiesCell: world.setCubeOccupiesCell,
        moveCubeTo: world.moveCubeTo,
        setCubeOpacity,
        fadeCubeTo,
        getGridFocus: world.getGridFocus,
        setGridFocus: (position) => {
            world.setGridFocus(position)
            applyPositions()
        },
        moveGridFocusTo: world.moveGridFocusTo,
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
        travelWithCube: world.travelWithCube,
        update,
        dispose: () => {
            if (disposed) return
            disposed = true
            for (const id of [...cubes.keys()]) removeCube(id)
            world.dispose()
            scene.remove(grid)
            gridLines.dispose()
            geometryCache.dispose()
        },
    }
}
