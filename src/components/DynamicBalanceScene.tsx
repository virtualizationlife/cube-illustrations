import { useCallback, type JSX } from 'react'

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
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.055
const EDGE_DISTANCE = 7
const RING_POSITIONS: readonly GridCoordinate[] = [
    { column: 0, row: -1 },
    { column: 1, row: -1 },
    { column: 1, row: 0 },
    { column: 1, row: 1 },
    { column: 0, row: 1 },
    { column: -1, row: 1 },
    { column: -1, row: 0 },
    { column: -1, row: -1 },
]
const BALANCE_CUBE_IDS = Array.from(
    { length: RING_POSITIONS.length },
    (_, index) => `dynamic-balance-${index}`
)

interface DynamicBalanceController {
    readonly dispose: () => void
}

const getEdgePosition = ({ column, row }: GridCoordinate): GridCoordinate => ({
    column: column * EDGE_DISTANCE,
    row: row * EDGE_DISTANCE,
})

const createDynamicBalanceAnimation = (
    runtime: GridSceneRuntime,
    initialAssignments: Array<string | null>,
    initialCarrierId: string,
    initialGapIndex: number
): DynamicBalanceController => {
    let cancelled = false
    let assignments = initialAssignments
    let carrierId = initialCarrierId
    let gapIndex = initialGapIndex
    const delay = createCancellableDelay()

    const play = async (): Promise<void> => {
        await delay.wait(0.8)
        while (!cancelled) {
            const gapPosition = RING_POSITIONS[gapIndex]
            if (gapPosition === undefined) return
            await Promise.all([
                runtime.moveCubeTo(carrierId, gapPosition, {
                    duration: 0.72,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(carrierId, 1, {
                    duration: 0.72,
                    easing: 'easeOutCubic',
                }),
            ])
            assignments[gapIndex] = carrierId
            if (cancelled) return
            await delay.wait(0.4)

            gapIndex = (gapIndex + 4) % RING_POSITIONS.length
            const outgoingId = assignments[gapIndex]
            const outgoingPosition = RING_POSITIONS[gapIndex]
            if (outgoingId === null || outgoingId === undefined || outgoingPosition === undefined) {
                return
            }
            assignments[gapIndex] = null
            await Promise.all([
                runtime.moveCubeTo(outgoingId, getEdgePosition(outgoingPosition), {
                    duration: 0.72,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(outgoingId, 0, {
                    duration: 0.72,
                    easing: 'easeOutCubic',
                }),
            ])
            carrierId = outgoingId
            if (cancelled) return

            const rotationDirection = Math.random() >= 0.5 ? 1 : -1
            const redistributionSteps = 1 + Math.floor(Math.random() * 3)
            for (let step = 0; step < redistributionSteps; step += 1) {
                const sourceIndex =
                    (gapIndex + rotationDirection + RING_POSITIONS.length) %
                    RING_POSITIONS.length
                const movingId = assignments[sourceIndex]
                const destination = RING_POSITIONS[gapIndex]
                if (movingId === null || movingId === undefined || destination === undefined) {
                    return
                }
                await runtime.moveCubeTo(movingId, destination, {
                    duration: 0.28,
                    easing: 'easeInOutCubic',
                })
                assignments[gapIndex] = movingId
                assignments[sourceIndex] = null
                gapIndex = sourceIndex
                if (cancelled) return
                await delay.wait(0.08)
            }
            await delay.wait(0.6)
        }
    }

    void startSceneAnimation('Dynamic Balance', play)
    return {
        dispose: () => {
            cancelled = true
            delay.cancel()
            assignments = []
        },
    }
}

/** A compact group exchanges one member and redistributes its vacancy indefinitely. */
export const DynamicBalanceScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            runtime.setCubePosition(MAIN_CUBE_ID, { column: 0, row: 0 })
            const gapIndex = 0
            const assignments: Array<string | null> = Array.from(
                { length: RING_POSITIONS.length },
                () => null
            )
            let carrierId = ''

            BALANCE_CUBE_IDS.forEach((cubeId, index) => {
                if (index === gapIndex) {
                    carrierId = cubeId
                    const gapPosition = RING_POSITIONS[gapIndex]
                    if (gapPosition !== undefined) {
                        runtime.addCube({
                            id: cubeId,
                            position: getEdgePosition(gapPosition),
                            opacity: 0,
                            faceLabels,
                        })
                    }
                    return
                }
                const position = RING_POSITIONS[index]
                if (position === undefined) return
                assignments[index] = cubeId
                runtime.addCube({ id: cubeId, position, faceLabels })
            })

            const animation = createDynamicBalanceAnimation(
                runtime,
                assignments,
                carrierId,
                gapIndex
            )
            return () => animation.dispose()
        },
        [faceLabels]
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 17,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 9,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame: () => undefined,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
