import { useCallback, useRef, type JSX } from 'react'

import { CubeSceneViewport } from './CubeSceneViewport'
import {
    createGridSceneAnimation,
    type GridEncounterPauseConfig,
    type GridProximityOpacityConfig,
    type GridRandomWalkConfig,
    type GridSceneAnimationController,
    type GridSceneMovementMode,
} from './gridSceneAnimation'
import type {
    GridCoordinate,
    GridSceneCubeDefinition,
} from './gridSceneRuntime'
import {
    useSimpleCubeScene,
    type IllustrationSceneSizeProps,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from './useSimpleCubeScene'

const DEFAULT_INITIAL_DELAY_S = 0.8
const DEFAULT_MOVE_DURATION_S = 1.2
const DEFAULT_STEP_PAUSE_S = 0.35

export interface GridPathCubeSceneProps extends IllustrationSceneSizeProps {
    readonly movementMode: GridSceneMovementMode
    readonly route?: readonly GridCoordinate[]
    readonly randomWalk?: GridRandomWalkConfig
    readonly additionalCubes?: readonly GridSceneCubeDefinition[]
    readonly additionalCubesFactory?: () => readonly GridSceneCubeDefinition[]
    readonly proximityOpacity?: GridProximityOpacityConfig
    readonly encounterPause?: GridEncounterPauseConfig
    readonly initialDelay?: number
    readonly moveDuration?: number
    readonly stepPause?: number
}

export const GridPathCubeScene = ({
    cubeSize,
    cubeCornerRadius,
    gridCellSize,
    gridCellCount,
    gridOpacity,
    gridFadeInnerRadiusCells,
    gridFadeOuterRadiusCells,
    mainCubeFaceLabels,
    cameraAzimuthDeg,
    cameraElevationDeg,
    viewOffsetY,
    hoverCells,
    movementMode,
    route = [],
    randomWalk,
    additionalCubes = [],
    additionalCubesFactory,
    proximityOpacity,
    encounterPause,
    initialDelay = DEFAULT_INITIAL_DELAY_S,
    moveDuration = DEFAULT_MOVE_DURATION_S,
    stepPause = DEFAULT_STEP_PAUSE_S,
}: GridPathCubeSceneProps): JSX.Element => {
    const animationRef = useRef<GridSceneAnimationController | null>(null)

    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            const animation = createGridSceneAnimation({
                runtime,
                movementMode,
                route,
                randomWalk,
                additionalCubes,
                additionalCubesFactory,
                proximityOpacity,
                encounterPause,
                initialDelay,
                moveDuration,
                stepPause,
            })
            animationRef.current = animation

            return () => {
                animation.dispose()
                if (animationRef.current === animation) animationRef.current = null
            }
        },
        [
            additionalCubes,
            additionalCubesFactory,
            encounterPause,
            initialDelay,
            moveDuration,
            movementMode,
            proximityOpacity,
            randomWalk,
            route,
            stepPause,
        ]
    )

    const onFrame = useCallback(({ delta }: SimpleCubeFrameContext): void => {
        animationRef.current?.update(delta)
    }, [])

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize,
        cubeCornerRadius,
        gridCellSize,
        gridCellCount,
        gridOpacity,
        gridFadeInnerRadiusCells,
        gridFadeOuterRadiusCells,
        mainCubeFaceLabels,
        cameraAzimuthDeg,
        cameraElevationDeg,
        viewOffsetY,
        hoverCells,
        enableCubeHover: true,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
