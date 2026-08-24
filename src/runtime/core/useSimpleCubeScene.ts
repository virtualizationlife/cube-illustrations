import { useEffect, useRef, useState, type RefObject } from 'react'
import type * as ThreeWebGpuNamespace from 'three/webgpu'

import { createDisposerStack } from '@runtime/core/createDisposerStack'
import { createSceneLoopController } from '@runtime/core/createSceneLoopController'
import { createSceneWorld, DEFAULT_CAMERA_ELEVATION_DEG } from '@runtime/core/createSceneWorld'
import { getSceneTimeScale } from '@runtime/core/timeScale'
import { bindGridCubeHover, type GridCubeHoverController } from '@runtime/grid/bindGridCubeHover'
import { getCubeFaceLabelsKey, type GridCubeFaceLabelInput } from '@runtime/grid/cubeFaceLabels'
import { getWideGridFadeRadii } from '@runtime/grid/gridFade'
import type { GridSceneCubeEntry, GridSceneRuntime } from '@runtime/grid/gridSceneRuntime'
import { createStandaloneRenderer } from '@runtime/rendering/createStandaloneRenderer'
import { useSceneRenderHost, type CubeRendererStatus } from '@runtime/rendering/SceneRenderHost'

export type { CubeRendererStatus } from '@runtime/rendering/SceneRenderHost'
export { ILLUSTRATION_VIEWPORT } from '@runtime/rendering/createStandaloneRenderer'

type Object3D = InstanceType<typeof ThreeWebGpuNamespace.Object3D>
type Scene = InstanceType<typeof ThreeWebGpuNamespace.Scene>
type PerspectiveCamera = InstanceType<typeof ThreeWebGpuNamespace.PerspectiveCamera>

/** Frames longer than this are clamped, so a stalled tab cannot jump the animation. */
const MAX_FRAME_DELTA_S = 0.05

export type SimpleCubeFrameContext = {
    readonly mesh: Object3D
    readonly runtime: GridSceneRuntime
    readonly camera: PerspectiveCamera
    readonly delta: number
    readonly elapsed: number
    /** The standalone canvas, or the host slot element when a SceneRenderHost is present. */
    readonly canvas: HTMLElement
    readonly THREE: typeof ThreeWebGpuNamespace
}

export type SimpleCubeSetupContext = {
    readonly mesh: Object3D
    readonly runtime: GridSceneRuntime
    readonly scene: Scene
    readonly camera: PerspectiveCamera
    /** The standalone canvas, or the host slot element when a SceneRenderHost is present. */
    readonly canvas: HTMLElement
    readonly THREE: typeof ThreeWebGpuNamespace
}

export type IllustrationSceneSizeProps = {
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

export type UseSimpleCubeSceneOptions = {
    /**
     * Changing this value tears the scene down and builds it again. `onSetup` is held in a
     * ref, so a new callback identity alone never restarts anything — callers that need a
     * restart have to say so here.
     */
    readonly lifecycleKey?: unknown
    readonly enableCubeHover?: boolean
    readonly onCubeHoverChange?: (cube: GridSceneCubeEntry | null) => void
    readonly onSetup?: (context: SimpleCubeSetupContext) => (() => void) | undefined
    readonly onFrame: (context: SimpleCubeFrameContext) => void
} & IllustrationSceneSizeProps

export type SimpleCubeSceneHandle = {
    /** Points to the standalone canvas, or to the host slot element under SceneRenderHost. */
    readonly canvasRef: RefObject<HTMLCanvasElement | HTMLDivElement | null>
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
    lifecycleKey,
    enableCubeHover = false,
    onCubeHoverChange,
    onSetup,
    onFrame,
}: UseSimpleCubeSceneOptions): SimpleCubeSceneHandle => {
    const canvasRef = useRef<HTMLCanvasElement | HTMLDivElement>(null)
    const renderHost = useSceneRenderHost()
    const registerWithHost = renderHost?.register
    const wakeHost = renderHost?.wake
    const [status, setStatus] = useState<CubeRendererStatus>('loading')
    const defaultGridFadeRadii = getWideGridFadeRadii(gridCellCount)
    const resolvedGridFadeOuterRadiusCells =
        gridFadeOuterRadiusCells ?? defaultGridFadeRadii.outerRadiusCells
    const resolvedGridFadeInnerRadiusCells =
        gridFadeInnerRadiusCells ?? defaultGridFadeRadii.innerRadiusCells
    // Labels are compared by value, so a caller passing an object literal does not tear the
    // scene down on every render. A genuine change does rebuild it: the labels reach cubes
    // the scene adds itself, and those are not this hook's to reconcile — `mainCubeFaceLabels`
    // describes the main cube, while a scene may give its other cubes labels of their own.
    const faceLabelsKey = getCubeFaceLabelsKey(mainCubeFaceLabels)
    const runtimeRef = useRef<GridSceneRuntime | null>(null)
    const mainCubeFaceLabelsRef = useRef(mainCubeFaceLabels)
    mainCubeFaceLabelsRef.current = mainCubeFaceLabels
    const onFrameRef = useRef(onFrame)
    const onSetupRef = useRef(onSetup)
    const onCubeHoverChangeRef = useRef(onCubeHoverChange)
    onFrameRef.current = onFrame
    onSetupRef.current = onSetup
    onCubeHoverChangeRef.current = onCubeHoverChange

    useEffect(() => {
        const element = canvasRef.current
        if (element === null) return
        const hostMode = registerWithHost !== undefined
        const standaloneCanvas = hostMode
            ? null
            : element instanceof HTMLCanvasElement
              ? element
              : null
        if (!hostMode && standaloneCanvas === null) return

        // Every acquired resource is registered here, so teardown is one call from anywhere
        // and a resource acquired after teardown is released the moment it appears.
        const disposers = createDisposerStack()

        const setup = async (): Promise<void> => {
            const THREE = await import('three/webgpu')
            // Every await below is a point where the component may already have unmounted.
            // The disposer stack releases what was registered; these checks stop the setup
            // itself from carrying on with a world that is already torn down.
            if (disposers.isDisposed()) return

            const world = createSceneWorld({
                THREE,
                cubeSize,
                cubeCornerRadius,
                gridCellSize,
                gridCellCount,
                gridOpacity,
                gridFadeInnerRadiusCells: resolvedGridFadeInnerRadiusCells,
                gridFadeOuterRadiusCells: resolvedGridFadeOuterRadiusCells,
                cameraAzimuthDeg,
                cameraElevationDeg,
                viewOffsetY,
                hoverCells,
                mainCubeFaceLabels: mainCubeFaceLabelsRef.current,
            })
            if (disposers.isDisposed()) {
                world.dispose()
                return
            }
            disposers.add(() => {
                runtimeRef.current = null
                world.dispose()
            })
            runtimeRef.current = world.runtime
            const { scene, camera, runtime, mesh } = world

            let renderer: InstanceType<typeof THREE.WebGPURenderer> | null = null
            if (standaloneCanvas !== null) {
                const standalone = await createStandaloneRenderer({
                    THREE,
                    canvas: standaloneCanvas,
                    camera,
                })
                if (disposers.isDisposed()) {
                    standalone?.dispose()
                    return
                }
                if (standalone === null) {
                    setStatus('unsupported')
                    disposers.dispose()
                    return
                }
                disposers.add(standalone.dispose)
                renderer = standalone.renderer
            }

            const teardownSetup = onSetupRef.current?.({
                mesh,
                runtime,
                scene,
                camera,
                canvas: element,
                THREE,
            })
            if (typeof teardownSetup === 'function') disposers.add(teardownSetup)

            let hoverController: GridCubeHoverController | null = null
            if (enableCubeHover) {
                hoverController = bindGridCubeHover({
                    runtime,
                    camera,
                    canvas: element,
                    THREE,
                    onChange: (cube) => {
                        onCubeHoverChangeRef.current?.(cube)
                    },
                })
                disposers.add(hoverController.dispose)
            }

            let elapsed = 0
            const loop = createSceneLoopController({
                THREE,
                element,
                scene,
                camera,
                renderer,
                registerWithHost,
                wakeHost,
                onStatusChange: setStatus,
                update: (rawDelta) => {
                    // The clamp guards against a stalled tab; the scale is what makes the
                    // whole scene — transitions, physics and elapsed alike — run faster.
                    const delta = Math.min(rawDelta, MAX_FRAME_DELTA_S) * getSceneTimeScale()
                    elapsed += delta
                    runtime.update(delta)
                    hoverController?.update()
                    onFrameRef.current({
                        mesh,
                        runtime,
                        camera,
                        delta,
                        elapsed,
                        canvas: element,
                        THREE,
                    })
                },
            })
            disposers.add(loop.dispose)

            if (!hostMode) setStatus('ready')
        }

        // Without this a failure inside the asynchronous setup becomes a silent unhandled
        // rejection, which is exactly the class of problem this lifecycle is meant to surface.
        // Whatever was acquired before the failure is released straight away rather than
        // being held until the component happens to unmount.
        void setup().catch((error: unknown) => {
            disposers.dispose()
            console.error('[cube-illustrations] scene setup failed', error)
        })

        return () => {
            disposers.dispose()
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
        faceLabelsKey,
        lifecycleKey,
        registerWithHost,
        wakeHost,
    ])

    return { canvasRef, status }
}
