import type * as ThreeWebGpuNamespace from 'three/webgpu'

import { getSharedGpuDevice } from '@runtime/rendering/sharedGpuDevice'

type WebGpuRenderer = InstanceType<typeof ThreeWebGpuNamespace.WebGPURenderer>
type PerspectiveCamera = InstanceType<typeof ThreeWebGpuNamespace.PerspectiveCamera>

/** Fallback drawing-buffer size, used only while the canvas has no laid-out box yet. */
export const ILLUSTRATION_VIEWPORT = 300

export type CreateStandaloneRendererOptions = {
    readonly THREE: typeof ThreeWebGpuNamespace
    readonly canvas: HTMLCanvasElement
    readonly camera: PerspectiveCamera
}

export type StandaloneRenderer = {
    readonly renderer: WebGpuRenderer
    readonly dispose: () => void
}

/**
 * Creates the renderer a scene owns when it draws into its own canvas, and keeps its
 * backbuffer matched to the canvas box. Resolves to null when WebGPU cannot start, which
 * is a supported outcome rather than an error.
 */
export const createStandaloneRenderer = async ({
    THREE,
    canvas,
    camera,
}: CreateStandaloneRendererOptions): Promise<StandaloneRenderer | null> => {
    const device = await getSharedGpuDevice()
    const renderer = new THREE.WebGPURenderer(
        device === null
            ? { canvas, antialias: true, alpha: true }
            : { canvas, antialias: true, alpha: true, device }
    )
    renderer.setClearColor(0x000000, 0)

    try {
        await renderer.init()
    } catch {
        renderer.dispose()
        return null
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // Standalone scenes retain their own appropriately sized backbuffer.
    let appliedWidth = 0
    let appliedHeight = 0
    const applyViewportSize = (): void => {
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

    return {
        renderer,
        dispose: () => {
            resizeObserver.disconnect()
            void renderer.setAnimationLoop(null)
            renderer.dispose()
        },
    }
}
