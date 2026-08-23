import { useEffect, useRef, useState, type RefObject } from 'react'

import type * as ThreeWebGpuNamespace from 'three/webgpu'

import type { GridCubeFaceLabelInput } from './cubeFaceLabels'
import { getWideGridFadeRadii } from './gridFade'
import {
    bindGridCubeHover,
    type GridCubeHoverController,
} from './bindGridCubeHover'
import {
    createGridSceneRuntime,
    type GridSceneCubeEntry,
    type GridSceneRuntime,
} from './gridSceneRuntime'
import { getSharedGpuDevice } from './sharedGpuDevice'

type WebGpuRenderer = InstanceType<typeof ThreeWebGpuNamespace.WebGPURenderer>
type Object3D = InstanceType<typeof ThreeWebGpuNamespace.Object3D>
type Scene = InstanceType<typeof ThreeWebGpuNamespace.Scene>
type PerspectiveCamera = InstanceType<typeof ThreeWebGpuNamespace.PerspectiveCamera>

export type CubeRendererStatus = 'loading' | 'ready' | 'unsupported'

/** Fallback drawing-buffer size, used only while the canvas has no laid-out box yet. */
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
    const defaultGridFadeRadii = getWideGridFadeRadii(gridCellCount)
    const resolvedGridFadeOuterRadiusCells =
        gridFadeOuterRadiusCells ?? defaultGridFadeRadii.outerRadiusCells
    const resolvedGridFadeInnerRadiusCells =
        gridFadeInnerRadiusCells ?? defaultGridFadeRadii.innerRadiusCells
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
        let disconnectResizeObserver: (() => void) | null = null
        let stopLoop: (() => void) | null = null
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
                gridFadeInnerRadiusCells: resolvedGridFadeInnerRadiusCells,
                gridFadeOuterRadiusCells: resolvedGridFadeOuterRadiusCells,
                mainCubeSize: cubeSize,
                mainCubeHoverCells: hoverCells,
                cubeCornerRadius,
                mainCubeFaceLabels,
            })
            const mesh = runtime.mainCube

            // No lights: every material in these scenes is a *BasicMaterial, which ignores
            // them entirely. They only ever cost render-list and lighting-state work.

            // A null device means WebGPU is unavailable; the renderer then picks its own
            // backend and falls back to WebGL2 exactly as it did before.
            const device = await getSharedGpuDevice()
            if (disposed) {
                runtime.dispose()
                runtime = null
                return
            }

            renderer = new THREE.WebGPURenderer(
                device === null
                    ? { canvas, antialias: true, alpha: true }
                    : { canvas, antialias: true, alpha: true, device }
            )
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

            // Follow the element instead of assuming a fixed 300 logical pixels: a smaller
            // slot stops paying for pixels the browser would only downscale away, and a
            // larger one no longer gets a stretched, under-resolved image.
            let appliedWidth = 0
            let appliedHeight = 0
            const applyViewportSize = (): void => {
                if (renderer === null) return
                const width = Math.max(1, Math.round(canvas.clientWidth) || ILLUSTRATION_VIEWPORT)
                const height = Math.max(1, Math.round(canvas.clientHeight) || ILLUSTRATION_VIEWPORT)
                if (width === appliedWidth && height === appliedHeight) return
                appliedWidth = width
                appliedHeight = height
                renderer.setSize(width, height, false)
                camera.aspect = width / height
                camera.updateProjectionMatrix()
            }
            applyViewportSize()

            const resizeObserver = new ResizeObserver(applyViewportSize)
            resizeObserver.observe(canvas)
            disconnectResizeObserver = () => {
                resizeObserver.disconnect()
            }

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

            let lastTimerElapsed = 0
            // Scene clock accumulated from clamped deltas rather than read straight off the
            // timer, so a scene that was paused off-screen resumes where it stopped instead
            // of finding its hold timings expired by the length of the pause.
            let elapsed = 0

            const renderFrame = (): void => {
                timer.update()
                const timerElapsed = timer.getElapsed()
                const delta = Math.min(timerElapsed - lastTimerElapsed, 0.05)
                lastTimerElapsed = timerElapsed
                elapsed += delta

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
            }

            // A page of scenes only ever has a handful on screen. Rendering the rest costs a
            // full frame each and shows nobody anything, so the loop follows visibility.
            let loopRunning = false
            let intersecting = false
            const setLoopRunning = (shouldRun: boolean): void => {
                if (renderer === null || shouldRun === loopRunning) return
                loopRunning = shouldRun
                void renderer.setAnimationLoop(shouldRun ? renderFrame : null)
            }
            const syncLoopState = (): void => {
                setLoopRunning(intersecting && !document.hidden)
            }

            const intersectionObserver = new IntersectionObserver(
                (entries) => {
                    const entry = entries[entries.length - 1]
                    if (entry === undefined) return
                    intersecting = entry.isIntersecting
                    syncLoopState()
                },
                // Start a scene slightly before it scrolls in so it is already running.
                { rootMargin: '128px' }
            )
            intersectionObserver.observe(canvas)
            document.addEventListener('visibilitychange', syncLoopState)
            stopLoop = () => {
                intersectionObserver.disconnect()
                document.removeEventListener('visibilitychange', syncLoopState)
                setLoopRunning(false)
            }

            setStatus('ready')
        }

        void setup()

        return () => {
            disposed = true
            stopLoop?.()
            stopLoop = null
            teardownSetup?.()
            teardownSetup = null
            hoverController?.dispose()
            hoverController = null
            disconnectResizeObserver?.()
            disconnectResizeObserver = null
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
        resolvedGridFadeInnerRadiusCells,
        resolvedGridFadeOuterRadiusCells,
        enableCubeHover,
        cameraAzimuthDeg,
        cameraElevationDeg,
        viewOffsetY,
        hoverCells,
        mainCubeFaceLabels,
    ])

    return { canvasRef, status }
}
