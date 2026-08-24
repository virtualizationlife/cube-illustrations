import type * as ThreeWebGpuNamespace from 'three/webgpu'

import type { GridCubeFaceLabelInput } from './cubeFaceLabels'
import {
    createGridSceneRuntime,
    type GridSceneRuntime,
} from './gridSceneRuntime'

type Object3D = InstanceType<typeof ThreeWebGpuNamespace.Object3D>
type Scene = InstanceType<typeof ThreeWebGpuNamespace.Scene>
type PerspectiveCamera = InstanceType<typeof ThreeWebGpuNamespace.PerspectiveCamera>

/** Camera distance from look-at; elevation defaults to 35° above the horizon. */
const CAMERA_DISTANCE = 1.05
export const DEFAULT_CAMERA_ELEVATION_DEG = 35

export interface CreateSceneWorldOptions {
    readonly THREE: typeof ThreeWebGpuNamespace
    readonly cubeSize: number
    readonly cubeCornerRadius?: number
    readonly gridCellSize: number
    readonly gridCellCount: number
    readonly gridOpacity?: number
    readonly gridFadeInnerRadiusCells: number
    readonly gridFadeOuterRadiusCells: number
    readonly cameraAzimuthDeg: number
    readonly cameraElevationDeg: number
    readonly viewOffsetY: number
    readonly hoverCells: number
    readonly mainCubeFaceLabels?: GridCubeFaceLabelInput
}

export interface SceneWorld {
    readonly scene: Scene
    readonly camera: PerspectiveCamera
    readonly runtime: GridSceneRuntime
    readonly mesh: Object3D
    readonly dispose: () => void
}

/** Builds the three.js scene, its camera and the grid runtime. No React, no renderer. */
export const createSceneWorld = ({
    THREE,
    cubeSize,
    cubeCornerRadius,
    gridCellSize,
    gridCellCount,
    gridOpacity,
    gridFadeInnerRadiusCells,
    gridFadeOuterRadiusCells,
    cameraAzimuthDeg,
    cameraElevationDeg,
    viewOffsetY,
    hoverCells,
    mainCubeFaceLabels,
}: CreateSceneWorldOptions): SceneWorld => {
    // Keep bottom face just above the grid plane so edges don't z-fight and vanish.
    const cubeCenterY = hoverCells * gridCellSize + cubeSize / 2 + gridCellSize * 0.02
    const lookAtY = cubeCenterY + viewOffsetY
    const cameraAzimuth = (cameraAzimuthDeg * Math.PI) / 180
    const cameraElevation = (cameraElevationDeg * Math.PI) / 180

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    const horizontal = CAMERA_DISTANCE * Math.cos(cameraElevation)
    camera.position.set(
        horizontal * Math.sin(cameraAzimuth),
        lookAtY + CAMERA_DISTANCE * Math.sin(cameraElevation),
        horizontal * Math.cos(cameraAzimuth)
    )
    camera.lookAt(0, lookAtY, 0)

    const runtime = createGridSceneRuntime({
        scene,
        THREE,
        gridCellSize,
        gridCellCount,
        gridOpacity,
        gridFadeInnerRadiusCells,
        gridFadeOuterRadiusCells,
        mainCubeSize: cubeSize,
        mainCubeHoverCells: hoverCells,
        cubeCornerRadius,
        mainCubeFaceLabels,
    })

    return {
        scene,
        camera,
        runtime,
        mesh: runtime.mainCube,
        dispose: () => runtime.dispose(),
    }
}
