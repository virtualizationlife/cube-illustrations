import type { JSX, RefObject } from 'react'

import { useSceneRenderHost, type CubeRendererStatus } from '@runtime/rendering/SceneRenderHost'

export type CubeSceneViewportProps = {
    readonly canvasRef: RefObject<HTMLCanvasElement | HTMLDivElement | null>
    readonly status: CubeRendererStatus
}

/** Shared canvas shell for cube scenes, including the WebGPU fallback state. */
export const CubeSceneViewport = ({ canvasRef, status }: CubeSceneViewportProps): JSX.Element => {
    const host = useSceneRenderHost()

    return (
        <div
            className='cube_illustrations_slot'
            data-status={status}
            data-scene-ready={status === 'ready' ? 'true' : 'false'}
        >
            {host === null && (
                <canvas
                    ref={canvasRef as RefObject<HTMLCanvasElement | null>}
                    className='cube_illustrations_canvas'
                    data-ready={status === 'ready' ? 'true' : 'false'}
                />
            )}
            {host !== null && (
                <div
                    ref={canvasRef as RefObject<HTMLDivElement | null>}
                    className='cube_illustrations_scene_element'
                />
            )}
            {status === 'unsupported' && (
                <div className='cube_illustrations_fallback'>WebGPU unavailable</div>
            )}
        </div>
    )
}
