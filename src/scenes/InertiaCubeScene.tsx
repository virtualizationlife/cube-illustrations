import { useCallback, useRef, type JSX } from 'react'

import type { Object3D, Vector3 } from 'three'

import { CubeSceneViewport } from './CubeSceneViewport'
import type { GridCubeFaceLabelInput } from './cubeFaceLabels'
import {
    useSimpleCubeScene,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from './useSimpleCubeScene'

const DRAG_SENSITIVITY = 0.005
const VELOCITY_DAMPING = 0.992
const INITIAL_SPIN_Y = 0.55

export interface InertiaCubeSceneProps {
    readonly cubeSize: number
    /** Cube corner radius in world units. Defaults to 3% of cubeSize. */
    readonly cubeCornerRadius?: number
    readonly gridCellSize: number
    readonly gridCellCount: number
    readonly cameraAzimuthDeg: number
    readonly cameraElevationDeg?: number
    readonly viewOffsetY: number
    readonly hoverCells: number
    readonly enableInertia?: boolean
    readonly mainCubeFaceLabels?: GridCubeFaceLabelInput
}

export const InertiaCubeScene = ({
    cubeSize,
    cubeCornerRadius,
    gridCellSize,
    gridCellCount,
    cameraAzimuthDeg,
    cameraElevationDeg,
    viewOffsetY,
    hoverCells,
    enableInertia = true,
    mainCubeFaceLabels,
}: InertiaCubeSceneProps): JSX.Element => {
    const enableInertiaRef = useRef(enableInertia)
    enableInertiaRef.current = enableInertia

    const velocityRef = useRef({ x: 0, y: enableInertia ? INITIAL_SPIN_Y : 0 })
    const draggingRef = useRef(false)
    const lastPointerRef = useRef<{ x: number; y: number; time: number } | null>(null)
    const meshRef = useRef<Object3D | null>(null)
    const worldXRef = useRef<Vector3 | null>(null)
    const worldYRef = useRef<Vector3 | null>(null)

    const onSetup = useCallback(({ mesh, canvas, THREE }: SimpleCubeSetupContext): (() => void) => {
        meshRef.current = mesh
        worldXRef.current = new THREE.Vector3(1, 0, 0)
        worldYRef.current = new THREE.Vector3(0, 1, 0)
        velocityRef.current = { x: 0, y: enableInertiaRef.current ? INITIAL_SPIN_Y : 0 }
        draggingRef.current = false
        lastPointerRef.current = null

        if (!enableInertiaRef.current) {
            canvas.style.cursor = 'default'
            return () => {
                canvas.style.cursor = ''
                meshRef.current = null
                worldXRef.current = null
                worldYRef.current = null
            }
        }

        const onPointerDown = (event: PointerEvent): void => {
            draggingRef.current = true
            lastPointerRef.current = {
                x: event.clientX,
                y: event.clientY,
                time: performance.now(),
            }
            canvas.setPointerCapture(event.pointerId)
            canvas.style.cursor = 'grabbing'
        }

        const onPointerMove = (event: PointerEvent): void => {
            const last = lastPointerRef.current
            const worldX = worldXRef.current
            const worldY = worldYRef.current
            const target = meshRef.current
            if (
                !draggingRef.current ||
                last === null ||
                worldX === null ||
                worldY === null ||
                target === null
            ) {
                return
            }

            const now = performance.now()
            const dx = event.clientX - last.x
            const dy = event.clientY - last.y
            const dt = Math.max((now - last.time) / 1000, 1 / 240)
            lastPointerRef.current = { x: event.clientX, y: event.clientY, time: now }

            const rx = dy * DRAG_SENSITIVITY
            const ry = dx * DRAG_SENSITIVITY
            target.rotateOnWorldAxis(worldX, rx)
            target.rotateOnWorldAxis(worldY, ry)
            velocityRef.current.x = rx / dt
            velocityRef.current.y = ry / dt
        }

        const endDrag = (event: PointerEvent): void => {
            if (!draggingRef.current) return
            draggingRef.current = false
            lastPointerRef.current = null
            if (canvas.hasPointerCapture(event.pointerId)) {
                canvas.releasePointerCapture(event.pointerId)
            }
            canvas.style.cursor = 'grab'
        }

        canvas.style.cursor = 'grab'
        canvas.addEventListener('pointerdown', onPointerDown)
        canvas.addEventListener('pointermove', onPointerMove)
        canvas.addEventListener('pointerup', endDrag)
        canvas.addEventListener('pointercancel', endDrag)

        return () => {
            canvas.removeEventListener('pointerdown', onPointerDown)
            canvas.removeEventListener('pointermove', onPointerMove)
            canvas.removeEventListener('pointerup', endDrag)
            canvas.removeEventListener('pointercancel', endDrag)
            canvas.style.cursor = ''
            meshRef.current = null
            worldXRef.current = null
            worldYRef.current = null
        }
    }, [])

    const onFrame = useCallback(({ mesh, delta }: SimpleCubeFrameContext): void => {
        if (!enableInertiaRef.current || draggingRef.current) return

        const worldX = worldXRef.current
        const worldY = worldYRef.current
        if (worldX === null || worldY === null) return

        const velocity = velocityRef.current
        mesh.rotateOnWorldAxis(worldX, velocity.x * delta)
        mesh.rotateOnWorldAxis(worldY, velocity.y * delta)

        const damp = VELOCITY_DAMPING ** (delta * 60)
        velocity.x *= damp
        velocity.y *= damp
    }, [])

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize,
        cubeCornerRadius,
        gridCellSize,
        gridCellCount,
        cameraAzimuthDeg,
        cameraElevationDeg,
        viewOffsetY,
        hoverCells,
        mainCubeFaceLabels,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
