import type * as ThreeWebGpuNamespace from 'three/webgpu'

import type { CubeRendererStatus, SceneRenderSlot } from './SceneRenderHost'

type WebGpuRenderer = InstanceType<typeof ThreeWebGpuNamespace.WebGPURenderer>
type Scene = InstanceType<typeof ThreeWebGpuNamespace.Scene>
type PerspectiveCamera = InstanceType<typeof ThreeWebGpuNamespace.PerspectiveCamera>

export interface CreateSceneLoopControllerOptions {
    readonly THREE: typeof ThreeWebGpuNamespace
    readonly element: HTMLElement
    readonly scene: Scene
    readonly camera: PerspectiveCamera
    /** Advances the scene by one frame. */
    readonly update: (delta: number) => void
    /** Present when the scene draws itself; absent when a host draws it. */
    readonly renderer: WebGpuRenderer | null
    readonly registerWithHost:
        | ((slot: SceneRenderSlot) => () => void)
        | undefined
    readonly wakeHost: (() => void) | undefined
    readonly onStatusChange: (status: CubeRendererStatus) => void
}

export interface SceneLoopController {
    readonly dispose: () => void
}

/**
 * Drives a scene's frames, either by registering it with a page-level host or by running
 * its own animation loop. A scene only runs while it is on screen and the tab is visible.
 *
 * Deliberately a factory rather than a hook: the loop can only be built once the
 * asynchronous renderer setup has finished, which is inside an effect, not at render time.
 */
export const createSceneLoopController = ({
    THREE,
    element,
    scene,
    camera,
    update,
    renderer,
    registerWithHost,
    wakeHost,
    onStatusChange,
}: CreateSceneLoopControllerOptions): SceneLoopController => {
    let intersecting = false
    let syncLoopState: (() => void) | null = null

    const intersectionObserver = new IntersectionObserver(
        (entries) => {
            const entry = entries[entries.length - 1]
            if (entry !== undefined) {
                intersecting = entry.isIntersecting
                syncLoopState?.()
                wakeHost?.()
            }
        },
        // Start a scene slightly before it scrolls in so it is already running.
        { rootMargin: '128px' }
    )
    intersectionObserver.observe(element)

    if (registerWithHost !== undefined) {
        const unregister = registerWithHost({
            element,
            scene,
            camera,
            update,
            isActive: () => intersecting,
            onStatusChange,
        })
        return {
            dispose: () => {
                intersectionObserver.disconnect()
                unregister()
            },
        }
    }

    const timer = new THREE.Timer()
    timer.connect(document)

    const renderFrame = (timestamp?: number): void => {
        timer.update(timestamp)
        update(timer.getDelta())
        renderer?.render(scene, camera)
    }

    let loopRunning = false
    const setLoopRunning = (shouldRun: boolean): void => {
        if (renderer === null || shouldRun === loopRunning) return
        loopRunning = shouldRun
        void renderer.setAnimationLoop(shouldRun ? renderFrame : null)
    }
    const handleVisibilityChange = (): void => {
        setLoopRunning(intersecting && !document.hidden)
    }
    syncLoopState = handleVisibilityChange
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return {
        dispose: () => {
            intersectionObserver.disconnect()
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            setLoopRunning(false)
            timer.disconnect()
        },
    }
}
