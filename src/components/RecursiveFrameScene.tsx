import { useCallback, useRef, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import { createCancellableDelay } from '../scenes/createCancellableDelay'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
import {
    createScenePresentation,
    type ScenePresentationController,
} from '../scenes/scenePresentation'
import { startSceneAnimation } from '../scenes/startSceneAnimation'
import {
    useSimpleCubeScene,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.045
const INNER_RADIUS = 2
const MIDDLE_RADIUS = 4
const OUTER_RADIUS = 6
const EXIT_RADIUS = 8
const FRAME_OPACITIES = [0.9, 0.58, 0.32] as const
const FRAME_DIRECTIONS: readonly GridCoordinate[] = [
    { column: 0, row: -1 },
    { column: 1, row: 0 },
    { column: 0, row: 1 },
    { column: -1, row: 0 },
]
const PROCESS_ROUTE: readonly GridCoordinate[] = [
    { column: 0, row: -1 },
    { column: 1, row: -1 },
    { column: 1, row: 0 },
    { column: 1, row: 1 },
    { column: 0, row: 1 },
    { column: -1, row: 1 },
    { column: -1, row: 0 },
    { column: -1, row: -1 },
]
const FRAME_IDS = Array.from({ length: 3 }, (_, frameIndex) =>
    FRAME_DIRECTIONS.map((_, directionIndex) =>
        `recursive-frame-${frameIndex}-${directionIndex}`
    )
)

interface RecursiveFrameController {
    readonly presentation: ScenePresentationController
    readonly dispose: () => void
}

const getFramePosition = (
    direction: GridCoordinate,
    radius: number
): GridCoordinate => ({
    column: direction.column * radius,
    row: direction.row * radius,
})

const createRecursiveFrameAnimation = (
    runtime: GridSceneRuntime
): RecursiveFrameController => {
    let cancelled = false
    let frames = FRAME_IDS.map((ids) => [...ids])
    const delay = createCancellableDelay()
    const presentation = createScenePresentation({
        zoom: 0.96,
        gridOpacity: 0.5,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 10,
    })

    const moveProcess = async (): Promise<void> => {
        let routeIndex = 1
        while (!cancelled) {
            const destination = PROCESS_ROUTE[routeIndex]
            if (destination === undefined) return
            await runtime.moveCubeTo(MAIN_CUBE_ID, destination, {
                duration: 0.28,
                easing: 'linear',
            })
            routeIndex = (routeIndex + 1) % PROCESS_ROUTE.length
        }
    }

    const moveFrame = async (
        ids: readonly string[],
        radius: number,
        opacity: number
    ): Promise<void> => {
        await Promise.all(
            ids.flatMap((id, index) => {
                const direction = FRAME_DIRECTIONS[index]
                if (direction === undefined) return []
                return [
                    runtime.moveCubeTo(id, getFramePosition(direction, radius), {
                        duration: 0.9,
                        easing: 'easeInOutCubic',
                    }),
                    runtime.fadeCubeTo(id, opacity, {
                        duration: 0.9,
                        easing: 'easeOutCubic',
                    }),
                ]
            })
        )
    }

    const shiftFrames = async (): Promise<void> => {
        const innerFrame = frames[0]
        const middleFrame = frames[1]
        const outerFrame = frames[2]
        if (
            innerFrame === undefined ||
            middleFrame === undefined ||
            outerFrame === undefined
        ) {
            return
        }

        presentation.setTarget({
            zoom: 1.16,
            gridOpacity: 0.38,
            gridFadeInnerRadiusCells: 2,
        })
        await Promise.all([
            moveFrame(outerFrame, EXIT_RADIUS, 0),
            moveFrame(middleFrame, OUTER_RADIUS, FRAME_OPACITIES[2]),
            moveFrame(innerFrame, MIDDLE_RADIUS, FRAME_OPACITIES[1]),
        ])
        if (cancelled) return

        outerFrame.forEach((id, index) => {
            const direction = FRAME_DIRECTIONS[index]
            if (direction === undefined) return
            runtime.setCubePosition(id, getFramePosition(direction, INNER_RADIUS))
        })

        presentation.setTarget({
            zoom: 0.96,
            gridOpacity: 0.5,
            gridFadeInnerRadiusCells: 3,
        })
        await Promise.all(
            outerFrame.map((id) =>
                runtime.fadeCubeTo(id, FRAME_OPACITIES[0], {
                    duration: 0.48,
                    easing: 'easeOutCubic',
                })
            )
        )
        frames = [outerFrame, innerFrame, middleFrame]
    }

    const cycleFrames = async (): Promise<void> => {
        await delay.wait(1.4)
        while (!cancelled) {
            await shiftFrames()
            if (!cancelled) await delay.wait(2.2)
        }
    }

    void startSceneAnimation('Recursive Frame process', moveProcess)
    void startSceneAnimation('Recursive Frame levels', cycleFrames)

    return {
        presentation,
        dispose: () => {
            cancelled = true
            delay.cancel()
            frames = []
        },
    }
}

/** Nested frames renew indefinitely while the main cube preserves one continuous path. */
export const RecursiveFrameScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const controllerRef = useRef<RecursiveFrameController | null>(null)
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            runtime.setCubePosition(MAIN_CUBE_ID, PROCESS_ROUTE[0])
            const radii = [INNER_RADIUS, MIDDLE_RADIUS, OUTER_RADIUS] as const

            FRAME_IDS.forEach((ids, frameIndex) => {
                const radius = radii[frameIndex]
                const opacity = FRAME_OPACITIES[frameIndex]
                if (radius === undefined || opacity === undefined) return
                ids.forEach((id, directionIndex) => {
                    const direction = FRAME_DIRECTIONS[directionIndex]
                    if (direction === undefined) return
                    runtime.addCube({
                        id,
                        position: getFramePosition(direction, radius),
                        opacity,
                        occupiesCell: false,
                        faceLabels,
                    })
                })
            })

            const controller = createRecursiveFrameAnimation(runtime)
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
        gridCellCount: 19,
        gridOpacity: 0.5,
        gridFadeInnerRadiusCells: 3,
        gridFadeOuterRadiusCells: 10,
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
