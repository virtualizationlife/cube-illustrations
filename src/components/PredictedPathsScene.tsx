import { useCallback, useRef, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps, GridCubeFaceLabelInput } from '../scenes/cubeFaceLabels'
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
import {
    useSimpleCubeScene,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.045
const ENTRY: GridCoordinate = { column: -7, row: 0 }
const VISIBLE_START: GridCoordinate = { column: -5, row: 0 }
const JUNCTION: GridCoordinate = { column: -3, row: 0 }
const EXIT: GridCoordinate = { column: 7, row: 0 }

interface PredictedBranch {
    readonly route: readonly GridCoordinate[]
    readonly successful: boolean
}

interface PredictionScenario {
    readonly obstacles: readonly GridCoordinate[]
    readonly branches: readonly PredictedBranch[]
}

const SCENARIOS: readonly PredictionScenario[] = [
    {
        obstacles: [
            { column: 0, row: 0 },
            { column: 1, row: -2 },
            { column: 1, row: -3 },
        ],
        branches: [
            {
                route: [
                    { column: -2, row: 0 },
                    { column: -1, row: 0 },
                ],
                successful: false,
            },
            {
                route: [
                    { column: -2, row: -2 },
                    { column: 0, row: -2 },
                ],
                successful: false,
            },
            {
                route: [
                    { column: -2, row: 2 },
                    { column: 1, row: 2 },
                    { column: 4, row: 2 },
                    { column: 5, row: 0 },
                ],
                successful: true,
            },
        ],
    },
    {
        obstacles: [
            { column: 0, row: 0 },
            { column: 1, row: 2 },
            { column: 1, row: 3 },
        ],
        branches: [
            {
                route: [
                    { column: -2, row: 0 },
                    { column: -1, row: 0 },
                ],
                successful: false,
            },
            {
                route: [
                    { column: -2, row: 2 },
                    { column: 0, row: 2 },
                ],
                successful: false,
            },
            {
                route: [
                    { column: -2, row: -2 },
                    { column: 1, row: -2 },
                    { column: 4, row: -2 },
                    { column: 5, row: 0 },
                ],
                successful: true,
            },
        ],
    },
]

interface PredictedPathsController {
    readonly presentation: ScenePresentationController
    readonly dispose: () => void
}

const createPredictedPathsAnimation = (
    runtime: GridSceneRuntime,
    faceLabels: GridCubeFaceLabelInput | undefined
): PredictedPathsController => {
    let cancelled = false
    let scenarioIndex = 0
    const delay = createCancellableDelay()
    const presentation = createScenePresentation({
        zoom: 1,
        gridOpacity: 0.55,
        gridFadeInnerRadiusCells: 5,
        gridFadeOuterRadiusCells: 8,
    })

    const movePrediction = async (id: string, route: readonly GridCoordinate[]): Promise<void> => {
        for (const position of route.slice(1)) {
            await runtime.moveCubeTo(id, position, {
                duration: 0.48,
                easing: 'easeInOutCubic',
            })
            if (cancelled) return
        }
    }

    const clearCubes = async (ids: readonly string[]): Promise<void> => {
        await Promise.all(
            ids.map((id) =>
                runtime.fadeCubeTo(id, 0, { duration: 0.32, easing: 'easeOutCubic' })
            )
        )
        ids.forEach((id) => runtime.removeCube(id))
    }

    const playScenario = async (scenario: PredictionScenario): Promise<void> => {
        // Move the main cube away from the default center cell before adding an
        // obstacle at (0, 0), otherwise the first scenario cannot be created.
        runtime.setCubePosition(MAIN_CUBE_ID, ENTRY)
        runtime.setCubeOpacity(MAIN_CUBE_ID, 0)

        const obstacleIds = scenario.obstacles.map((position, index) => {
            const id = `prediction-obstacle-${index}`
            runtime.addCube({ id, position, faceLabels })
            return id
        })

        await Promise.all([
            runtime.moveCubeTo(MAIN_CUBE_ID, VISIBLE_START, {
                duration: 0.55,
                easing: 'easeInOutCubic',
            }),
            runtime.fadeCubeTo(MAIN_CUBE_ID, 1, {
                duration: 0.55,
                easing: 'easeOutCubic',
            }),
        ])
        await runtime.moveCubeTo(MAIN_CUBE_ID, JUNCTION, {
            duration: 0.58,
            easing: 'easeInOutCubic',
        })
        if (cancelled) return

        presentation.setTarget({
            zoom: 0.8,
            gridOpacity: 0.72,
            gridFadeInnerRadiusCells: 7,
            gridFadeOuterRadiusCells: 9,
        })
        await delay.wait(0.7)

        const predictionIds = scenario.branches.map((branch, index) => {
            const id = `prediction-branch-${index}`
            const start = branch.route[0]
            if (start !== undefined) {
                runtime.addCube({ id, position: start, opacity: 0, faceLabels })
                void runtime.fadeCubeTo(id, branch.successful ? 0.42 : 0.24, {
                    duration: 0.3,
                    easing: 'easeOutCubic',
                })
            }
            return id
        })

        await Promise.all(
            scenario.branches.map((branch, index) =>
                movePrediction(predictionIds[index] ?? '', branch.route)
            )
        )
        if (cancelled) return
        await delay.wait(0.75)

        const successfulIndex = scenario.branches.findIndex((branch) => branch.successful)
        const successfulBranch = scenario.branches[successfulIndex]
        const successfulPredictionId = predictionIds[successfulIndex]
        const failedIds = predictionIds.filter((_, index) => index !== successfulIndex)
        await clearCubes(failedIds)
        if (successfulBranch === undefined || successfulPredictionId === undefined) return

        const trailIds: string[] = []
        for (let index = 0; index < successfulBranch.route.length - 1; index += 1) {
            const position = successfulBranch.route[index]
            if (position === undefined) continue
            const id = `prediction-trail-${index}`
            runtime.addCube({ id, position, opacity: 0.14, faceLabels })
            trailIds.push(id)
        }

        presentation.setTarget({
            zoom: 1.08,
            gridOpacity: 0.48,
            gridFadeInnerRadiusCells: 4.5,
            gridFadeOuterRadiusCells: 7,
        })
        await delay.wait(0.45)

        for (let index = 0; index < successfulBranch.route.length; index += 1) {
            const position = successfulBranch.route[index]
            if (position === undefined) continue
            const markerId = trailIds[index]
            if (markerId !== undefined) {
                await runtime.fadeCubeTo(markerId, 0, {
                    duration: 0.16,
                    easing: 'easeOutCubic',
                })
                runtime.removeCube(markerId)
            } else {
                await runtime.fadeCubeTo(successfulPredictionId, 0, {
                    duration: 0.2,
                    easing: 'easeOutCubic',
                })
                runtime.removeCube(successfulPredictionId)
            }
            await runtime.moveCubeTo(MAIN_CUBE_ID, position, {
                duration: 0.5,
                easing: 'easeInOutCubic',
            })
            if (cancelled) return
        }

        await Promise.all([
            runtime.moveCubeTo(MAIN_CUBE_ID, EXIT, {
                duration: 0.55,
                easing: 'easeInOutCubic',
            }),
            runtime.fadeCubeTo(MAIN_CUBE_ID, 0, {
                duration: 0.55,
                easing: 'easeOutCubic',
            }),
        ])
        obstacleIds.forEach((id) => runtime.removeCube(id))
        await delay.wait(0.6)
    }

    const play = async (): Promise<void> => {
        await delay.wait(0.6)
        while (!cancelled) {
            const scenario = SCENARIOS[scenarioIndex]
            if (scenario === undefined) return
            await playScenario(scenario)
            scenarioIndex = (scenarioIndex + 1) % SCENARIOS.length
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

/** Translucent predictions test possible futures before the main cube acts. */
export const PredictedPathsScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const controllerRef = useRef<PredictedPathsController | null>(null)
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): (() => void) => {
            const controller = createPredictedPathsAnimation(runtime, faceLabels)
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
        gridCellCount: 17,
        gridOpacity: 0.55,
        gridFadeInnerRadiusCells: 5,
        gridFadeOuterRadiusCells: 8,
        cameraAzimuthDeg: 15,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
