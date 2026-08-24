import type * as ThreeWebGpuNamespace from 'three/webgpu'

import type { GridSceneCubeEntry, GridSceneRuntime } from './gridSceneRuntime'

type Object3D = InstanceType<typeof ThreeWebGpuNamespace.Object3D>
type PerspectiveCamera = InstanceType<typeof ThreeWebGpuNamespace.PerspectiveCamera>
type Intersection = ThreeWebGpuNamespace.Intersection

export type GridCubeHoverController = {
    readonly update: () => void
    readonly dispose: () => void
}

export type BindGridCubeHoverOptions = {
    readonly runtime: GridSceneRuntime
    readonly camera: PerspectiveCamera
    readonly canvas: HTMLElement
    readonly THREE: typeof ThreeWebGpuNamespace
    readonly onChange: (cube: GridSceneCubeEntry | null) => void
}

/**
 * Hover picking runs on every frame the pointer is over the canvas, because cubes move
 * under a stationary pointer. So the per-frame work is kept to the raycast itself: the hit
 * list is rebuilt only when cubes are added or removed, the intersection array is reused,
 * and each hit carries its cube's id, replacing a walk up the scene graph that searched the
 * cube list at every level.
 */
export const bindGridCubeHover = ({
    runtime,
    camera,
    canvas,
    THREE,
    onChange,
}: BindGridCubeHoverOptions): GridCubeHoverController => {
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const previousCursor = canvas.style.cursor
    const intersections: Intersection[] = []
    const entriesById = new Map<string, GridSceneCubeEntry>()
    let hitTargets: Object3D[] = []
    let cachedRevision = -1
    let pointerInside = false
    let hoveredCubeId: string | null = null

    const refreshHitTargets = (): void => {
        const revision = runtime.getCubeRevision()
        if (revision === cachedRevision) return
        cachedRevision = revision

        hitTargets = []
        entriesById.clear()
        for (const entry of runtime.getCubes()) {
            entriesById.set(entry.id, entry)
            // Only the body mesh is a direct child; edges are lines and labels sit in a group.
            for (const child of entry.object.children) {
                if (child instanceof THREE.Mesh) hitTargets.push(child)
            }
        }
    }

    const findHoveredCube = (): GridSceneCubeEntry | null => {
        for (const intersection of intersections) {
            const { cubeId, cubeObject } = intersection.object.userData
            if (typeof cubeId !== 'string') continue
            // Opacity 0 hides a cube by clearing `visible` on its group, and the group is
            // not what was raycast, so invisible cubes have to be stepped over here.
            if (cubeObject?.visible !== true) continue
            return entriesById.get(cubeId) ?? null
        }
        return null
    }

    const setHoveredCube = (cube: GridSceneCubeEntry | null): void => {
        const nextCubeId = cube?.id ?? null
        if (nextCubeId === hoveredCubeId) return
        hoveredCubeId = nextCubeId
        canvas.style.cursor = cube === null ? 'default' : 'pointer'
        onChange(cube)
    }

    const onPointerMove = (event: PointerEvent): void => {
        const bounds = canvas.getBoundingClientRect()
        if (bounds.width === 0 || bounds.height === 0) return
        pointerInside = true
        pointer.set(
            ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
            -((event.clientY - bounds.top) / bounds.height) * 2 + 1
        )
    }

    const onPointerLeave = (): void => {
        pointerInside = false
        setHoveredCube(null)
    }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)

    return {
        update: () => {
            if (!pointerInside) return
            refreshHitTargets()
            raycaster.setFromCamera(pointer, camera)
            intersections.length = 0
            raycaster.intersectObjects(hitTargets, false, intersections)
            setHoveredCube(findHoveredCube())
        },
        dispose: () => {
            canvas.removeEventListener('pointermove', onPointerMove)
            canvas.removeEventListener('pointerleave', onPointerLeave)
            if (hoveredCubeId !== null) onChange(null)
            hoveredCubeId = null
            canvas.style.cursor = previousCursor
        },
    }
}
