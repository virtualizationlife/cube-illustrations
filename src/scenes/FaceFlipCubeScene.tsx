import { useCallback, useRef, type JSX } from 'react'
import type { Quaternion, Vector3 } from 'three'

import { GRID_CUBE_FACES, type GridCubeFace, type GridCubeFaceLabelInput } from './cubeFaceLabels'
import { CubeSceneViewport } from './CubeSceneViewport'
import { MAIN_CUBE_ID, type GridSceneCubeEntry } from './gridSceneRuntime'
import { getRandomIndex } from './sceneRandom'
import {
    useSimpleCubeScene,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from './useSimpleCubeScene'

const FLIP_DURATION_S = 1
const FAST_FLIP_DURATION_S = 0.18
const FAST_FLIP_PAUSE_S = 0.06
const FAST_SEQUENCE_CHANCE = 0.22
const FAST_SEQUENCE_MIN_FLIPS = 3
const FAST_SEQUENCE_MAX_FLIPS = 5
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

const FACE_DIRECTIONS: Readonly<Record<GridCubeFace, readonly [number, number, number]>> = {
    front: [0, 0, 1],
    back: [0, 0, -1],
    left: [-1, 0, 0],
    right: [1, 0, 0],
    top: [0, 1, 0],
    bottom: [0, -1, 0],
}

type FlipState = {
    active: boolean
    progress: number
    duration: number
    from: Quaternion
    to: Quaternion
    down: Vector3
    normal: Vector3
}

export type FaceFlipCubeSceneProps = {
    readonly cubeSize: number
    /** Cube corner radius in world units. Defaults to 3% of cubeSize. */
    readonly cubeCornerRadius?: number
    readonly gridCellSize: number
    readonly gridCellCount: number
    readonly cameraAzimuthDeg: number
    readonly cameraElevationDeg?: number
    readonly viewOffsetY: number
    readonly hoverCells: number
    readonly mainCubeFaceLabels?: GridCubeFaceLabelInput
    /** Maximum vertical lift during a rotation, measured in grid cells. */
    readonly flipLiftCells?: number
    /** Produces labels for the faces hidden after every completed rotation. */
    readonly nextFaceLabels?: (hiddenFaces: readonly GridCubeFace[]) => GridCubeFaceLabelInput
}

export const FaceFlipCubeScene = ({
    cubeSize,
    cubeCornerRadius,
    gridCellSize,
    gridCellCount,
    cameraAzimuthDeg,
    cameraElevationDeg,
    viewOffsetY,
    hoverCells,
    mainCubeFaceLabels,
    flipLiftCells = 0,
    nextFaceLabels,
}: FaceFlipCubeSceneProps): JSX.Element => {
    const faceIndexRef = useRef(0)
    const holdUntilRef = useRef(HOLD_DURATION_S)
    const flipRef = useRef<FlipState | null>(null)
    const fastFlipsRemainingRef = useRef(0)
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
                duration: FLIP_DURATION_S,
                from,
                to,
                down,
                normal,
            }

            return () => {
                flipRef.current = null
                fastFlipsRemainingRef.current = 0
                targetScaleRef.current = 1
            }
        },
        []
    )

    const onCubeHoverChange = useCallback((cube: GridSceneCubeEntry | null): void => {
        targetScaleRef.current = cube === null ? 1 : HOVER_SCALE
    }, [])

    const onFrame = useCallback(
        ({ mesh, runtime, camera, delta, elapsed, THREE }: SimpleCubeFrameContext): void => {
            const scaleProgress = 1 - Math.exp(-delta / HOVER_SCALE_RESPONSE_S)
            const nextScale = mesh.scale.x + (targetScaleRef.current - mesh.scale.x) * scaleProgress
            mesh.scale.setScalar(nextScale)

            const flip = flipRef.current
            if (flip === null) return

            if (flip.active) {
                flip.progress = Math.min(1, flip.progress + delta / flip.duration)
                const eased = easeOutCubic(flip.progress)
                mesh.quaternion.slerpQuaternions(flip.from, flip.to, eased)
                const liftProgress = Math.sin(Math.PI * flip.progress) ** 2
                mesh.position.y += liftProgress * flipLiftCells * gridCellSize

                if (flip.progress >= 1) {
                    flip.active = false
                    if (nextFaceLabels !== undefined) {
                        mesh.updateWorldMatrix(true, false)
                        const worldQuaternion = mesh.getWorldQuaternion(new THREE.Quaternion())
                        const cubePosition = mesh.getWorldPosition(new THREE.Vector3())
                        const cameraPosition = camera.getWorldPosition(new THREE.Vector3())
                        const directionToCamera = cameraPosition.sub(cubePosition).normalize()
                        const hiddenFaces = GRID_CUBE_FACES.filter((face) => {
                            const direction = FACE_DIRECTIONS[face]
                            const worldNormal = new THREE.Vector3(...direction).applyQuaternion(
                                worldQuaternion
                            )
                            return worldNormal.dot(directionToCamera) <= 0
                        })
                        runtime.setCubeFaceLabels(MAIN_CUBE_ID, nextFaceLabels(hiddenFaces))
                    }
                    holdUntilRef.current =
                        elapsed +
                        (fastFlipsRemainingRef.current > 0 ? FAST_FLIP_PAUSE_S : HOLD_DURATION_S)
                }
                return
            }

            if (elapsed < holdUntilRef.current) return

            const continuesFastSequence = fastFlipsRemainingRef.current > 0
            const startsFastSequence =
                !continuesFastSequence && Math.random() < FAST_SEQUENCE_CHANCE
            if (continuesFastSequence) {
                fastFlipsRemainingRef.current -= 1
            } else if (startsFastSequence) {
                const totalFlips =
                    FAST_SEQUENCE_MIN_FLIPS +
                    Math.floor(
                        Math.random() * (FAST_SEQUENCE_MAX_FLIPS - FAST_SEQUENCE_MIN_FLIPS + 1)
                    )
                fastFlipsRemainingRef.current = totalFlips - 1
            }

            let next = faceIndexRef.current
            while (next === faceIndexRef.current) {
                next = getRandomIndex(FACE_NORMALS.length)
            }
            faceIndexRef.current = next

            const face = FACE_NORMALS[next]
            if (face === undefined) return

            flip.from.copy(mesh.quaternion)
            flip.normal.set(face[0], face[1], face[2])
            flip.to.setFromUnitVectors(flip.normal, flip.down)
            flip.progress = 0
            flip.duration =
                continuesFastSequence || startsFastSequence ? FAST_FLIP_DURATION_S : FLIP_DURATION_S
            flip.active = true
        },
        [flipLiftCells, gridCellSize, nextFaceLabels]
    )

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
        enableCubeHover: true,
        onCubeHoverChange,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
