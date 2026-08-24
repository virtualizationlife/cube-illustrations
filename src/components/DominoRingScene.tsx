import { useCallback, useRef, type JSX } from 'react'

import type { Vector3 } from 'three'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
} from '../scenes/gridSceneRuntime'
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
/** A full quarter-turn makes a cube finish exactly on the neighbouring outer tile. */
const TOPPLE_ANGLE = Math.PI / 2
const WAVE_STEP_S = 0.16
const TOPPLE_DURATION_S = 0.24
const WAVE_WIDTH = 4

/**
 * Every cube falls outwards, along one lower edge, to a free grid tile. The directions
 * are deliberately cardinal so a completed quarter-turn always lands precisely on a tile.
 */
const OUTWARD_DIRECTIONS: readonly { readonly x: number; readonly z: number }[] =
    RING_POSITIONS.map(({ column, row }) =>
        Math.abs(column) >= Math.abs(row)
            ? { x: Math.sign(column) || 1, z: 0 }
            : { x: 0, z: Math.sign(row) || 1 }
    )

const WAVE_HOLD_S = (WAVE_WIDTH - 1) * WAVE_STEP_S
const WAVE_CYCLE_S = RING_POSITIONS.length * WAVE_STEP_S

/** Smoothly travels from 0 to 1, with zero velocity at both exact tile positions. */
const easeHalfCosine = (progress: number): number =>
    0.5 - 0.5 * Math.cos(Math.PI * progress)

/**
 * A cube has an exact upright plateau, a full quarter-turn plateau, and a smooth return.
 * The plateaus make every loop land on real grid geometry instead of approaching it forever.
 */
const getToppleProgress = (elapsed: number, index: number): number => {
    const offset = index * WAVE_STEP_S
    const localTime = ((elapsed - offset) % WAVE_CYCLE_S + WAVE_CYCLE_S) % WAVE_CYCLE_S
    if (localTime < TOPPLE_DURATION_S) return easeHalfCosine(localTime / TOPPLE_DURATION_S)
    if (localTime < TOPPLE_DURATION_S + WAVE_HOLD_S) return 1
    if (localTime < TOPPLE_DURATION_S * 2 + WAVE_HOLD_S) {
        return easeHalfCosine(
            1 - (localTime - TOPPLE_DURATION_S - WAVE_HOLD_S) / TOPPLE_DURATION_S
        )
    }
    return 0
}

/** A topple that runs around a closed ring reaches its own start and never ends. */
export const DominoRingScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) | undefined => {
            RING_CUBE_IDS.forEach((cubeId, index) => {
                const position = RING_POSITIONS[index]
                if (position === undefined) return
                if (cubeId === MAIN_CUBE_ID) runtime.setCubePosition(cubeId, position)
                else runtime.addCube({ id: cubeId, position, faceLabels })
            })
            return undefined
        },
        [faceLabels]
    )

    const axisRef = useRef<Vector3 | null>(null)
    const pivotOffsetRef = useRef<Vector3 | null>(null)
    const rotatedPivotOffsetRef = useRef<Vector3 | null>(null)

    const onFrame = useCallback(
        ({ runtime, elapsed, THREE }: SimpleCubeFrameContext): void => {
            const axis = axisRef.current ?? new THREE.Vector3()
            axisRef.current = axis
            const pivotOffset = pivotOffsetRef.current ?? new THREE.Vector3()
            pivotOffsetRef.current = pivotOffset
            const rotatedPivotOffset = rotatedPivotOffsetRef.current ?? new THREE.Vector3()
            rotatedPivotOffsetRef.current = rotatedPivotOffset
            const halfEdge = GRID_CELL_SIZE / 2
            const floorY = GRID_CELL_SIZE * 0.02

            RING_CUBE_IDS.forEach((cubeId, index) => {
                const object = runtime.getCube(cubeId)
                const direction = OUTWARD_DIRECTIONS[index]
                const position = RING_POSITIONS[index]
                if (object === undefined || direction === undefined || position === undefined) return

                const angle = getToppleProgress(elapsed, index) * TOPPLE_ANGLE
                // This tangent axis and sign tip the upper face away from the ring.
                axis.set(-direction.z, 0, direction.x)
                object.quaternion.setFromAxisAngle(axis, -angle)

                // Rotate the cube around its outer lower edge, not its centre. At 90° the
                // centre is exactly one cardinal grid cell outwards and the cube lies flat.
                pivotOffset.set(direction.x * halfEdge, -halfEdge, direction.z * halfEdge)
                rotatedPivotOffset.copy(pivotOffset).applyAxisAngle(axis, -angle)
                object.position.set(
                    position.column * GRID_CELL_SIZE + pivotOffset.x - rotatedPivotOffset.x,
                    floorY + halfEdge + pivotOffset.y - rotatedPivotOffset.y,
                    position.row * GRID_CELL_SIZE + pivotOffset.z - rotatedPivotOffset.z
                )
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
