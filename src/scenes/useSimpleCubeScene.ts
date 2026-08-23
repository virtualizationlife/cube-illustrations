import { useEffect, useRef, useState, type RefObject } from 'react'

import type * as ThreeWebGpuNamespace from 'three/webgpu'

import type { GridCubeFaceLabelInput } from './cubeFaceLabels'
import {
    bindGridCubeHover,
    type GridCubeHoverController,
} from './bindGridCubeHover'
import {
    createGridSceneRuntime,
    type GridSceneCubeEntry,
    type GridSceneRuntime,
} from './gridSceneRuntime'

type WebGpuRenderer = InstanceType<typeof ThreeWebGpuNamespace.WebGPURenderer>
type Object3D = InstanceType<typeof ThreeWebGpuNamespace.Object3D>
type Scene = InstanceType<typeof ThreeWebGpuNamespace.Scene>
type PerspectiveCamera = InstanceType<typeof ThreeWebGpuNamespace.PerspectiveCamera>

export type CubeRendererStatus = 'loading' | 'ready' | 'unsupported'

export const ILLUSTRATION_VIEWPORT = 300

/** Camera distance from look-at; elevation defaults to 35° above the horizon. */
const CAMERA_DISTANCE = 1.05
const DEFAULT_CAMERA_ELEVATION_DEG = 35

export interface SimpleCubeFrameContext {
    readonly mesh: Object3D
    readonly runtime: GridSceneRuntime
    readonly camera: PerspectiveCamera
    readonly delta: number
    readonly elapsed: number
    readonly canvas: HTMLCanvasElement
    readonly THREE: typeof ThreeWebGpuNamespace
}

export interface SimpleCubeSetupContext {
    readonly mesh: Object3D
    readonly runtime: GridSceneRuntime
    readonly scene: Scene
    readonly camera: PerspectiveCamera
    readonly canvas: HTMLCanvasElement
    readonly THREE: typeof ThreeWebGpuNamespace
}

export interface IllustrationSceneSizeProps {
    readonly cubeSize: number
    /** Cube corner radius in world units. Defaults to 3% of cubeSize. */
    readonly cubeCornerRadius?: number
    readonly gridCellSize: number
    readonly gridCellCount: number
    /** Maximum line opacity after an entering grid line has fully appeared. */
    readonly gridOpacity?: number
    /** Radius in cells that remains fully opaque before radial fading starts. */
    readonly gridFadeInnerRadiusCells?: number
    /** Radius in cells where the radial grid fade reaches full transparency. */
    readonly gridFadeOuterRadiusCells?: number
    /** Horizontal camera angle in degrees (0 = +Z, 90 = +X). */
    readonly cameraAzimuthDeg: number
    /** Vertical camera angle above the horizon in degrees. Defaults to 35. */
    readonly cameraElevationDeg?: number
    /**
     * Vertical shift of the whole picture in world units.
     * 0 = look at the cube center; negative = look lower (cube sits higher in frame).
     * Camera pitch stays fixed — only the framing moves up/down.
     */
    readonly viewOffsetY: number
    /** How many grid cells the cube is lifted above the floor (0 = on the floor). */
    readonly hoverCells: number
    /** Optional text written on the main cube faces; each label is limited to 3 symbols. */
    readonly mainCubeFaceLabels?: GridCubeFaceLabelInput
}

export interface UseSimpleCubeSceneOptions extends IllustrationSceneSizeProps {
    readonly enableCubeHover?: boolean
    readonly onCubeHoverChange?: (cube: GridSceneCubeEntry | null) => void
    readonly onSetup?: (context: SimpleCubeSetupContext) => (() => void) | undefined
    readonly onFrame: (context: SimpleCubeFrameContext) => void
}

export interface SimpleCubeSceneHandle {
    readonly canvasRef: RefObject<HTMLCanvasElement | null>
    readonly status: CubeRendererStatus
}

export const useSimpleCubeScene = ({
    cubeSize,
    cubeCornerRadius,
    gridCellSize,
    gridCellCount,
    gridOpacity,
    gridFadeInnerRadiusCells,
    gridFadeOuterRadiusCells,
    cameraAzimuthDeg,
    cameraElevationDeg = DEFAULT_CAMERA_ELEVATION_DEG,
    viewOffsetY,
    hoverCells,
    mainCubeFaceLabels,
    enableCubeHover = false,
    onCubeHoverChange,
    onSetup,
    onFrame,
}: UseSimpleCubeSceneOptions): SimpleCubeSceneHandle => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [status, setStatus] = useState<CubeRendererStatus>('loading')
    const onFrameRef = useRef(onFrame)
    const onSetupRef = useRef(onSetup)
    const onCubeHoverChangeRef = useRef(onCubeHoverChange)
    onFrameRef.current = onFrame
    onSetupRef.current = onSetup
    onCubeHoverChangeRef.current = onCubeHoverChange

    useEffect(() => {
        const canvas = canvasRef.current
        if (canvas === null) return

        // Keep bottom face just above the grid plane so edges don't z-fight and vanish.
        const cubeCenterY = hoverCells * gridCellSize + cubeSize / 2 + gridCellSize * 0.02
        const lookAtY = cubeCenterY + viewOffsetY
        const cameraAzimuth = (cameraAzimuthDeg * Math.PI) / 180
        const cameraElevation = (cameraElevationDeg * Math.PI) / 180

        let disposed = false
        let renderer: WebGpuRenderer | null = null
        let disconnectTimer: (() => void) | null = null
        let teardownSetup: (() => void) | null = null
        let runtime: GridSceneRuntime | null = null
        let hoverController: GridCubeHoverController | null = null

        const setup = async (): Promise<void> => {
            const THREE = await import('three/webgpu')

            const scene = new THREE.Scene()
            const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
            const horizontal = CAMERA_DISTANCE * Math.cos(cameraElevation)
            camera.position.set(
                horizontal * Math.sin(cameraAzimuth),
                lookAtY + CAMERA_DISTANCE * Math.sin(cameraElevation),
                horizontal * Math.cos(cameraAzimuth)
            )
            camera.lookAt(0, lookAtY, 0)

            runtime = createGridSceneRuntime({
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
            const mesh = runtime.mainCube

            scene.add(new THREE.AmbientLight(0xffffff, 1.15))
            scene.add(new THREE.HemisphereLight(0xf0f2f5, 0x8a8e96, 0.85))

            renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true })
            renderer.setClearColor(0x000000, 0)

            try {
                await renderer.init()
            } catch {
                if (!disposed) setStatus('unsupported')
                renderer.dispose()
                renderer = null
                runtime.dispose()
                runtime = null
                return
            }

            if (disposed) {
                renderer.dispose()
                runtime.dispose()
                runtime = null
                return
            }

            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
            renderer.setSize(ILLUSTRATION_VIEWPORT, ILLUSTRATION_VIEWPORT, false)
            camera.aspect = 1
            camera.updateProjectionMatrix()

            const setupResult = onSetupRef.current?.({
                mesh,
                runtime,
                scene,
                camera,
                canvas,
                THREE,
            })
            if (typeof setupResult === 'function') teardownSetup = setupResult

            if (enableCubeHover) {
                hoverController = bindGridCubeHover({
                    runtime,
                    camera,
                    canvas,
                    THREE,
                    onChange: (cube) => {
                        onCubeHoverChangeRef.current?.(cube)
                    },
                })
            }

            if (disposed) {
                teardownSetup?.()
                teardownSetup = null
                hoverController?.dispose()
                hoverController = null
                renderer.dispose()
                runtime.dispose()
                runtime = null
                return
            }

            const timer = new THREE.Timer()
            timer.connect(document)
            disconnectTimer = () => {
                timer.disconnect()
            }

            let lastElapsed = 0

            void renderer.setAnimationLoop(() => {
                timer.update()
                const elapsed = timer.getElapsed()
                const delta = Math.min(elapsed - lastElapsed, 0.05)
                lastElapsed = elapsed

                runtime?.update(delta)
                hoverController?.update()
                if (runtime !== null) {
                    onFrameRef.current({
                        mesh,
                        runtime,
                        camera,
                        delta,
                        elapsed,
                        canvas,
                        THREE,
                    })
                }
                renderer?.render(scene, camera)
            })

            setStatus('ready')
        }

        void setup()

        return () => {
            disposed = true
            teardownSetup?.()
            teardownSetup = null
            hoverController?.dispose()
            hoverController = null
            disconnectTimer?.()
            disconnectTimer = null
            void renderer?.setAnimationLoop(null)
            renderer?.dispose()
            runtime?.dispose()
            runtime = null
        }
    }, [
        cubeSize,
        cubeCornerRadius,
        gridCellSize,
        gridCellCount,
        gridOpacity,
        gridFadeInnerRadiusCells,
        gridFadeOuterRadiusCells,
        enableCubeHover,
        cameraAzimuthDeg,
        cameraElevationDeg,
        viewOffsetY,
        hoverCells,
        mainCubeFaceLabels,
    ])

    return { canvasRef, status }
}
