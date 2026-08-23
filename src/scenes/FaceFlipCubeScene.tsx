import { useCallback, useRef, type JSX } from 'react'

import type { Quaternion, Vector3 } from 'three'

import { CubeSceneViewport } from './CubeSceneViewport'
import type { GridCubeFaceLabelInput } from './cubeFaceLabels'
import type { GridSceneCubeEntry } from './gridSceneRuntime'
import {
    useSimpleCubeScene,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from './useSimpleCubeScene'

const FLIP_DURATION_S = 1
const HOLD_DURATION_S = 2
const HOVER_SCALE = 1.2
const HOVER_SCALE_RESPONSE_S = 0.12

const easeOutCubic = (progress: number): number => 1 - (1 - progress) ** 3

/** Local face normals — which face rests on the grid (-Y world). */
const FACE_NORMALS: readonly (readonly [number, number, number])[] = [
    [0, -1, 0],
    [0, 1, 0],
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
]

interface FlipState {
    active: boolean
    progress: number
    from: Quaternion
    to: Quaternion
    down: Vector3
    normal: Vector3
}

export interface FaceFlipCubeSceneProps {
    readonly cubeSize: number
    /** Cube corner radius in world units. Defaults to 5% of cubeSize. */
    readonly cubeCornerRadius?: number
    readonly gridCellSize: number
    readonly gridCellCount: number
    readonly cameraAzimuthDeg: number
    readonly viewOffsetY: number
    readonly hoverCells: number
    readonly mainCubeFaceLabels?: GridCubeFaceLabelInput
}

export const FaceFlipCubeScene = ({
    cubeSize,
    cubeCornerRadius,
    gridCellSize,
    gridCellCount,
    cameraAzimuthDeg,
    viewOffsetY,
    hoverCells,
    mainCubeFaceLabels,
}: FaceFlipCubeSceneProps): JSX.Element => {
    const faceIndexRef = useRef(0)
    const holdUntilRef = useRef(HOLD_DURATION_S)
    const flipRef = useRef<FlipState | null>(null)
    const targetScaleRef = useRef(1)

    const onSetup = useCallback(
        ({ mesh, THREE }: SimpleCubeSetupContext): (() => void) | undefined => {
            const down = new THREE.Vector3(0, -1, 0)
            const normal = new THREE.Vector3()
            const from = new THREE.Quaternion()
            const to = new THREE.Quaternion()

            faceIndexRef.current = 0
            const firstFace = FACE_NORMALS[0]
            if (firstFace === undefined) {
                return undefined
            }

            normal.set(firstFace[0], firstFace[1], firstFace[2])
            to.setFromUnitVectors(normal, down)
            mesh.quaternion.copy(to)
            mesh.scale.setScalar(1)
            targetScaleRef.current = 1

            holdUntilRef.current = HOLD_DURATION_S
            flipRef.current = {
                active: false,
                progress: 0,
                from,
                to,
                down,
                normal,
            }

            return () => {
                flipRef.current = null
                targetScaleRef.current = 1
            }
        },
        []
    )

    const onCubeHoverChange = useCallback((cube: GridSceneCubeEntry | null): void => {
        targetScaleRef.current = cube === null ? 1 : HOVER_SCALE
    }, [])

    const onFrame = useCallback(({ mesh, delta, elapsed }: SimpleCubeFrameContext): void => {
        const scaleProgress = 1 - Math.exp(-delta / HOVER_SCALE_RESPONSE_S)
        const nextScale = mesh.scale.x + (targetScaleRef.current - mesh.scale.x) * scaleProgress
        mesh.scale.setScalar(nextScale)

        const flip = flipRef.current
        if (flip === null) return

        if (flip.active) {
            flip.progress = Math.min(1, flip.progress + delta / FLIP_DURATION_S)
            const eased = easeOutCubic(flip.progress)
            mesh.quaternion.slerpQuaternions(flip.from, flip.to, eased)

            if (flip.progress >= 1) {
                flip.active = false
                holdUntilRef.current = elapsed + HOLD_DURATION_S
            }
            return
        }

        if (elapsed < holdUntilRef.current) return

        let next = faceIndexRef.current
        while (next === faceIndexRef.current) {
            next = Math.floor(Math.random() * FACE_NORMALS.length)
        }
        faceIndexRef.current = next

        const face = FACE_NORMALS[next]
        if (face === undefined) return

        flip.from.copy(mesh.quaternion)
        flip.normal.set(face[0], face[1], face[2])
        flip.to.setFromUnitVectors(flip.normal, flip.down)
        flip.progress = 0
        flip.active = true
    }, [])

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize,
        cubeCornerRadius,
        gridCellSize,
        gridCellCount,
        cameraAzimuthDeg,
        viewOffsetY,
        hoverCells,
        mainCubeFaceLabels,
        enableCubeHover: true,
        onCubeHoverChange,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
