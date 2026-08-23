import { useCallback, useRef, type JSX } from 'react'

import type { Vector3 } from 'three'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
import { startSceneAnimation } from '../scenes/startSceneAnimation'
import {
    useSimpleCubeScene,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.055
const RING_POSITIONS: readonly GridCoordinate[] = [
    { column: 2, row: 0 },
    { column: 2, row: 1 },
    { column: 1, row: 2 },
    { column: 0, row: 2 },
    { column: -1, row: 2 },
    { column: -2, row: 1 },
    { column: -2, row: 0 },
    { column: -2, row: -1 },
    { column: -1, row: -2 },
    { column: 0, row: -2 },
    { column: 1, row: -2 },
    { column: 2, row: -1 },
]
const RING_CUBE_IDS: readonly string[] = [
    MAIN_CUBE_ID,
    ...Array.from(
        { length: RING_POSITIONS.length - 1 },
        (_, index) => `domino-ring-${index}`
    ),
]
/** Far enough from upright to read as a fallen piece, short of lying flat. */
const LEAN_ANGLE = Math.PI * 0.24
const LEAN_RESPONSE_S = 0.075
const WAVE_STEP_S = 0.15
const WAVE_WIDTH = 4

/** Horizontal axis each piece topples around: perpendicular to its place in the ring. */
const LEAN_AXES: readonly { readonly x: number; readonly z: number }[] =
    RING_POSITIONS.map((_, index) => {
        const count = RING_POSITIONS.length
        const next = RING_POSITIONS[(index + 1) % count]
        const previous = RING_POSITIONS[(index - 1 + count) % count]
        if (next === undefined || previous === undefined) return { x: 1, z: 0 }
        const tangentX = next.column - previous.column
        const tangentZ = next.row - previous.row
        const length = Math.hypot(tangentX, tangentZ) || 1
        return { x: tangentZ / length, z: -tangentX / length }
    })

interface LeanState {
    readonly current: number[]
    readonly target: number[]
}

interface DominoRingController {
    readonly lean: LeanState
    readonly dispose: () => void
}

const createDominoRingAnimation = (lean: LeanState): DominoRingController => {
    let cancelled = false
    const delay = createCancellableDelay()

    const play = async (): Promise<void> => {
        await delay.wait(1)
        let front = 0
        while (!cancelled) {
            lean.target[front % RING_POSITIONS.length] = 1
            const tail = front - WAVE_WIDTH
            if (tail >= 0) {
                lean.target[
                    ((tail % RING_POSITIONS.length) + RING_POSITIONS.length) %
                        RING_POSITIONS.length
                ] = 0
            }
            front += 1
            await delay.wait(WAVE_STEP_S)
        }
    }

    void startSceneAnimation('Domino Ring', play)
    return {
        lean,
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** A topple that runs around a closed ring reaches its own start and never ends. */
export const DominoRingScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const controllerRef = useRef<DominoRingController | null>(null)

    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            RING_CUBE_IDS.forEach((cubeId, index) => {
                const position = RING_POSITIONS[index]
                if (position === undefined) return
                if (cubeId === MAIN_CUBE_ID) runtime.setCubePosition(cubeId, position)
                else runtime.addCube({ id: cubeId, position, faceLabels })
            })
            const controller = createDominoRingAnimation({
                current: RING_POSITIONS.map(() => 0),
                target: RING_POSITIONS.map(() => 0),
            })
            controllerRef.current = controller
            return () => {
                controller.dispose()
                if (controllerRef.current === controller) controllerRef.current = null
            }
        },
        [faceLabels]
    )

    const axisRef = useRef<Vector3 | null>(null)

    const onFrame = useCallback(
        ({ runtime, delta, THREE }: SimpleCubeFrameContext): void => {
            const lean = controllerRef.current?.lean
            if (lean === undefined) return
            const axis = axisRef.current ?? new THREE.Vector3()
            axisRef.current = axis
            const progress = 1 - Math.exp(-delta / LEAN_RESPONSE_S)
            const halfEdge = GRID_CELL_SIZE / 2

            RING_CUBE_IDS.forEach((cubeId, index) => {
                const object = runtime.getCube(cubeId)
                const leanAxis = LEAN_AXES[index]
                const current = lean.current[index]
                const target = lean.target[index]
                if (
                    object === undefined ||
                    leanAxis === undefined ||
                    current === undefined ||
                    target === undefined
                ) {
                    return
                }

                const nextLean = current + (target - current) * progress
                lean.current[index] = nextLean
                const angle = nextLean * LEAN_ANGLE
                axis.set(leanAxis.x, 0, leanAxis.z)
                object.quaternion.setFromAxisAngle(axis, angle)
                // Keep the lowest corner on the grid instead of sinking through it.
                object.position.y +=
                    halfEdge * (Math.SQRT2 * Math.sin(Math.PI / 4 + angle) - 1)
            })
        },
        []
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 15,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 8,
        cameraAzimuthDeg: 35,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
