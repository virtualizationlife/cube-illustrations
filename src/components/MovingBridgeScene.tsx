import { useCallback, useRef, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import {
    MAIN_CUBE_ID,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
import {
    createScenePresentation,
    type ScenePresentationController,
} from '../scenes/scenePresentation'
import {
    useSimpleCubeScene,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.07
const INITIAL_RAIL_COLUMNS = [-2, -1, 0, 1, 2] as const
const UPPER_RAIL_IDS = INITIAL_RAIL_COLUMNS.map((_, index) => `bridge-upper-${index}`)
const LOWER_RAIL_IDS = INITIAL_RAIL_COLUMNS.map((_, index) => `bridge-lower-${index}`)

interface MovingBridgeController {
    readonly presentation: ScenePresentationController
    readonly dispose: () => void
}

const createMovingBridgeAnimation = (runtime: GridSceneRuntime): MovingBridgeController => {
    let cancelled = false
    let mainColumn = 0
    let frontColumn = 2
    let cycleCount = 0
    const upperQueue = [...UPPER_RAIL_IDS]
    const lowerQueue = [...LOWER_RAIL_IDS]
    const delay = createCancellableDelay()
    const presentation = createScenePresentation({
        zoom: 1.02,
        gridOpacity: 0.52,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 5.5,
    })

    const moveRearSupportsToFront = async (): Promise<void> => {
        const upperId = upperQueue.shift()
        const lowerId = lowerQueue.shift()
        if (upperId === undefined || lowerId === undefined) return
        frontColumn += 1
        await Promise.all([
            runtime.moveCubeTo(
                upperId,
                { column: frontColumn, row: -1 },
                { duration: 0.82, easing: 'easeInOutCubic' }
            ),
            runtime.moveCubeTo(
                lowerId,
                { column: frontColumn, row: 1 },
                { duration: 0.82, easing: 'easeInOutCubic' }
            ),
        ])
        upperQueue.push(upperId)
        lowerQueue.push(lowerId)
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.8)
        while (!cancelled) {
            presentation.setTarget({
                zoom: 0.94,
                gridOpacity: 0.46,
                gridFadeInnerRadiusCells: 3.5,
                gridFadeOuterRadiusCells: 6,
            })
            mainColumn += 1
            await runtime.travelWithCube(
                MAIN_CUBE_ID,
                { column: mainColumn, row: 0 },
                { duration: 0.62, easing: 'easeInOutCubic' }
            )
            if (cancelled) return

            cycleCount += 1
            const supportIsDelayed = cycleCount % 4 === 0
            if (supportIsDelayed) {
                presentation.setTarget({
                    zoom: 1.18,
                    gridOpacity: 0.7,
                    gridFadeInnerRadiusCells: 2,
                    gridFadeOuterRadiusCells: 4.5,
                })
                await delay.wait(1.05)
            }

            await moveRearSupportsToFront()
            if (cancelled) return
            presentation.setTarget({ zoom: 1.02, gridOpacity: 0.52 })
            await delay.wait(supportIsDelayed ? 0.35 : 0.16)
        }
    }

    void play()
    return {
        presentation,
        dispose: () => {
            cancelled = true
            delay.cancel()
        },
    }
}

/** Rear supports overtake a centered traveling cube and continuously rebuild its path ahead. */
export const MovingBridgeScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const controllerRef = useRef<MovingBridgeController | null>(null)
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            INITIAL_RAIL_COLUMNS.forEach((column, index) => {
                const upperId = UPPER_RAIL_IDS[index]
                const lowerId = LOWER_RAIL_IDS[index]
                if (upperId !== undefined) {
                    runtime.addCube({
                        id: upperId,
                        position: { column, row: -1 },
                        faceLabels,
                    })
                }
                if (lowerId !== undefined) {
                    runtime.addCube({
                        id: lowerId,
                        position: { column, row: 1 },
                        faceLabels,
                    })
                }
            })
            const controller = createMovingBridgeAnimation(runtime)
            controllerRef.current = controller
            return () => {
                controller.dispose()
                if (controllerRef.current === controller) controllerRef.current = null
            }
        },
        [faceLabels]
    )
    const onFrame = useCallback(
        ({ delta, camera, runtime }: SimpleCubeFrameContext): void => {
            controllerRef.current?.presentation.update(delta, camera, runtime)
        },
        []
    )

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: GRID_CELL_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 11,
        gridOpacity: 0.52,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 5.5,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
