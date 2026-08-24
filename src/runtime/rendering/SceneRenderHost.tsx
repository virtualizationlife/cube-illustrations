import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type JSX,
    type ReactNode,
} from 'react'
import type * as ThreeWebGpuNamespace from 'three/webgpu'

import { getSharedGpuDevice } from '@runtime/rendering/sharedGpuDevice'

type WebGpuRenderer = InstanceType<typeof ThreeWebGpuNamespace.WebGPURenderer>
type Scene = InstanceType<typeof ThreeWebGpuNamespace.Scene>
type PerspectiveCamera = InstanceType<typeof ThreeWebGpuNamespace.PerspectiveCamera>

export type CubeRendererStatus = 'loading' | 'ready' | 'unsupported'

export type SceneRenderSlot = {
    /** The DOM element occupied by this scene. */
    readonly element: HTMLElement
    readonly scene: Scene
    readonly camera: PerspectiveCamera
    /** Advances scene logic. The slot owns its accumulated elapsed time. */
    readonly update: (delta: number) => void
    /** Whether this slot should be updated and drawn this frame. */
    readonly isActive: () => boolean
    readonly onStatusChange: (status: CubeRendererStatus) => void
}

export type SceneRenderHostHandle = {
    readonly register: (slot: SceneRenderSlot) => () => void
    readonly wake: () => void
    readonly status: CubeRendererStatus
}

export type SceneRenderRect = {
    readonly viewport: {
        readonly x: number
        readonly y: number
        readonly width: number
        readonly height: number
    }
    readonly scissor: {
        readonly x: number
        readonly y: number
        readonly width: number
        readonly height: number
    }
}

/**
 * Converts a slot's viewport-relative DOM rect into logical renderer coordinates.
 * Three applies the renderer pixel ratio internally, so these values stay in CSS pixels.
 */
export const getSceneRenderRect = (
    slotRect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
    canvasRect: Pick<DOMRectReadOnly, 'left' | 'top'>,
    canvasWidth: number,
    canvasHeight: number
): SceneRenderRect => {
    const x = slotRect.left - canvasRect.left
    const y = slotRect.top - canvasRect.top
    const right = x + slotRect.width
    const bottom = y + slotRect.height
    const scissorLeft = Math.min(canvasWidth, Math.max(0, x))
    const scissorTop = Math.min(canvasHeight, Math.max(0, y))
    const scissorRight = Math.min(canvasWidth, Math.max(0, right))
    const scissorBottom = Math.min(canvasHeight, Math.max(0, bottom))

    return {
        viewport: {
            x,
            y,
            width: slotRect.width,
            height: slotRect.height,
        },
        scissor: {
            x: scissorLeft,
            y: scissorTop,
            width: Math.max(0, scissorRight - scissorLeft),
            height: Math.max(0, scissorBottom - scissorTop),
        },
    }
}

const SceneRenderHostContext = createContext<SceneRenderHostHandle | null>(null)

export const useSceneRenderHost = (): SceneRenderHostHandle | null =>
    useContext(SceneRenderHostContext)

export type SceneRenderHostProps = {
    readonly children: ReactNode
}

const HOST_CANVAS_CLASS = 'cube_illustrations_render_host_canvas'

/**
 * Renders all descendant cube scenes through one transparent, viewport-sized renderer.
 * Scenes still work without this provider, in which case useSimpleCubeScene keeps its
 * standalone renderer path.
 */
export const SceneRenderHost = ({ children }: SceneRenderHostProps): JSX.Element => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const slotsRef = useRef<SceneRenderSlot[]>([])
    const statusRef = useRef<CubeRendererStatus>('loading')
    const wakeLoopRef = useRef<() => void>(() => undefined)
    const [status, setStatus] = useState<CubeRendererStatus>('loading')

    const register = useCallback((slot: SceneRenderSlot): (() => void) => {
        slotsRef.current.push(slot)
        slot.onStatusChange(statusRef.current)
        wakeLoopRef.current()
        let registered = true
        return () => {
            if (!registered) return
            registered = false
            const index = slotsRef.current.indexOf(slot)
            if (index >= 0) slotsRef.current.splice(index, 1)
        }
    }, [])

    const wake = useCallback((): void => {
        wakeLoopRef.current()
    }, [])

    const handle = useMemo<SceneRenderHostHandle>(
        () => ({ register, wake, status }),
        [register, wake, status]
    )

    useEffect(() => {
        let disposed = false
        const isDisposed = (): boolean => disposed
        let renderer: WebGpuRenderer | null = null
        let disconnectResize: (() => void) | null = null
        let disconnectTimer: (() => void) | null = null

        const updateStatus = (nextStatus: CubeRendererStatus): void => {
            statusRef.current = nextStatus
            setStatus(nextStatus)
            for (const slot of slotsRef.current) slot.onStatusChange(nextStatus)
        }

        const setup = async (): Promise<void> => {
            const canvas = canvasRef.current
            if (canvas === null) return

            const THREE = await import('three/webgpu')
            if (disposed) return

            // The page-level path intentionally requires WebGPU. A null shared device
            // means every slot receives the same unsupported state instead of creating
            // one fallback renderer per scene.
            const device = await getSharedGpuDevice()
            if (isDisposed()) return
            if (device === null) {
                updateStatus('unsupported')
                return
            }

            renderer = new THREE.WebGPURenderer({
                canvas,
                antialias: true,
                alpha: true,
                device,
            })
            renderer.setClearColor(0x000000, 0)
            renderer.autoClear = false

            try {
                await renderer.init()
            } catch {
                if (!isDisposed()) updateStatus('unsupported')
                renderer.dispose()
                renderer = null
                return
            }

            if (isDisposed()) {
                renderer.dispose()
                renderer = null
                return
            }

            let pixelRatio = 1
            let cssWidth = 0
            let cssHeight = 0
            const resize = (): void => {
                if (renderer === null) return
                pixelRatio = Math.min(window.devicePixelRatio, 2)
                const bounds = canvas.getBoundingClientRect()
                cssWidth = Math.max(1, canvas.clientWidth || Math.round(bounds.width))
                cssHeight = Math.max(1, canvas.clientHeight || Math.round(bounds.height))
                renderer.setPixelRatio(pixelRatio)
                renderer.setSize(cssWidth, cssHeight, false)
            }
            resize()
            const resizeObserver = new ResizeObserver(resize)
            resizeObserver.observe(canvas)
            disconnectResize = () => {
                resizeObserver.disconnect()
            }

            const timer = new THREE.Timer()
            let loopRunning = false
            let setLoopRunning = (_shouldRun: boolean): void => undefined

            const renderFrame = (timestamp?: number): void => {
                if (renderer === null) return

                timer.update(timestamp)
                const delta = Math.min(timer.getDelta(), 0.05)
                const canvasRect = canvas.getBoundingClientRect()
                const canvasWidth = canvas.clientWidth
                const canvasHeight = canvas.clientHeight

                renderer.setScissorTest(false)
                renderer.setViewport(0, 0, canvasWidth, canvasHeight)
                renderer.clear()
                renderer.setScissorTest(true)

                for (const slot of slotsRef.current) {
                    if (!slot.isActive()) continue

                    const rect = slot.element.getBoundingClientRect()
                    if (rect.width <= 0 || rect.height <= 0) continue

                    const renderRect = getSceneRenderRect(
                        rect,
                        canvasRect,
                        canvasWidth,
                        canvasHeight
                    )

                    slot.camera.aspect = rect.width / rect.height
                    slot.camera.updateProjectionMatrix()
                    slot.update(delta)
                    if (renderRect.scissor.width <= 0 || renderRect.scissor.height <= 0) continue
                    renderer.setViewport(
                        renderRect.viewport.x,
                        renderRect.viewport.y,
                        renderRect.viewport.width,
                        renderRect.viewport.height
                    )
                    renderer.setScissor(
                        renderRect.scissor.x,
                        renderRect.scissor.y,
                        renderRect.scissor.width,
                        renderRect.scissor.height
                    )
                    renderer.render(slot.scene, slot.camera)
                }

                renderer.setScissorTest(false)
                if (!slotsRef.current.some((slot) => slot.isActive())) {
                    setLoopRunning(false)
                }
            }

            setLoopRunning = (shouldRun: boolean): void => {
                if (renderer === null || shouldRun === loopRunning) return
                loopRunning = shouldRun
                void renderer.setAnimationLoop(shouldRun ? renderFrame : null)
            }
            const wakeLoop = (): void => {
                if (document.hidden) return
                if (!slotsRef.current.some((slot) => slot.isActive())) return
                timer.reset()
                setLoopRunning(true)
            }
            wakeLoopRef.current = wakeLoop
            const syncLoopState = (): void => {
                if (document.hidden) {
                    setLoopRunning(false)
                    return
                }
                wakeLoop()
            }
            // The listener is removed by disconnectTimer when the async setup is torn down.
            // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
            document.addEventListener('visibilitychange', syncLoopState)
            disconnectTimer = () => {
                document.removeEventListener('visibilitychange', syncLoopState)
            }
            syncLoopState()
            updateStatus('ready')
        }

        void setup()

        return () => {
            disposed = true
            disconnectResize?.()
            disconnectResize = null
            disconnectTimer?.()
            disconnectTimer = null
            void renderer?.setAnimationLoop(null)
            renderer?.dispose()
            renderer = null
            wakeLoopRef.current = () => undefined
        }
    }, [])

    return (
        <SceneRenderHostContext.Provider value={handle}>
            {children}
            <canvas
                ref={canvasRef}
                className={HOST_CANVAS_CLASS}
                data-ready={status === 'ready' ? 'true' : 'false'}
                aria-hidden='true'
            />
        </SceneRenderHostContext.Provider>
    )
}
