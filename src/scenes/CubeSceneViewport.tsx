import type { JSX, RefObject } from 'react'

import type { CubeRendererStatus } from './useSimpleCubeScene'

export interface CubeSceneViewportProps {
    readonly canvasRef: RefObject<HTMLCanvasElement | null>
    readonly status: CubeRendererStatus
}

/** Shared canvas shell for cube scenes, including the WebGPU fallback state. */
export const CubeSceneViewport = ({
    canvasRef,
    status,
}: CubeSceneViewportProps): JSX.Element => (
    <div className='cube_illustrations__slot' data-status={status}>
        <canvas
            ref={canvasRef}
            className='cube_illustrations__canvas'
            data-ready={status === 'ready' ? 'true' : 'false'}
        />
        {status === 'unsupported' && (
            <div className='cube_illustrations__fallback'>WebGPU unavailable</div>
        )}
    </div>
)
