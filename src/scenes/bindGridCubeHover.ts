import type * as ThreeWebGpuNamespace from 'three/webgpu'

import type {
    GridSceneCubeEntry,
    GridSceneRuntime,
} from './gridSceneRuntime'

type Object3D = InstanceType<typeof ThreeWebGpuNamespace.Object3D>
type PerspectiveCamera = InstanceType<typeof ThreeWebGpuNamespace.PerspectiveCamera>

export interface GridCubeHoverController {
    readonly update: () => void
    readonly dispose: () => void
}

export interface BindGridCubeHoverOptions {
    readonly runtime: GridSceneRuntime
    readonly camera: PerspectiveCamera
    readonly canvas: HTMLCanvasElement
    readonly THREE: typeof ThreeWebGpuNamespace
    readonly onChange: (cube: GridSceneCubeEntry | null) => void
}

const findCubeEntry = (
    object: Object3D,
    cubes: readonly GridSceneCubeEntry[]
): GridSceneCubeEntry | null => {
    let current: Object3D | null = object
    while (current !== null) {
        const cube = cubes.find((entry) => entry.object === current)
        if (cube !== undefined) return cube
        current = current.parent
    }
    return null
}

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
    let pointerInside = false
    let hoveredCubeId: string | null = null

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
            const cubes = runtime.getCubes().filter((cube) => cube.object.visible)
            const hitTargets = cubes.flatMap((cube) =>
                cube.object.children.filter((child) => child instanceof THREE.Mesh)
            )
            raycaster.setFromCamera(pointer, camera)
            const intersection = raycaster.intersectObjects(hitTargets, false)[0]
            setHoveredCube(
                intersection === undefined ? null : findCubeEntry(intersection.object, cubes)
            )
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
