import { MAIN_CUBE_ID, type GridCoordinate } from '../scenes/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '../sdk/defineScene'

const GRID_CELL_SIZE = 0.04
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

const BASE_PRESENTATION = {
    zoom: 1,
    gridOpacity: 0.55,
    gridFadeInnerRadiusCells: 4,
    gridFadeOuterRadiusCells: 12,
} as const

interface PredictedPathsState {
    scenarioIndex: number
}

/** Translucent predictions test possible futures before the main cube acts. */
export const PredictedPathsScene = defineScene<CubeSceneProps, PredictedPathsState>({
    metadata: {
        id: 'predicted-paths',
        title: 'Predicted Paths',
        tags: ['world', 'prediction'],
        description: 'Possible futures are tested before the cube commits to one.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 23,
        gridOpacity: BASE_PRESENTATION.gridOpacity,
        gridFadeInnerRadiusCells: BASE_PRESENTATION.gridFadeInnerRadiusCells,
        gridFadeOuterRadiusCells: BASE_PRESENTATION.gridFadeOuterRadiusCells,
        cameraAzimuthDeg: 15,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    presentation: BASE_PRESENTATION,
    setup: () => ({ scenarioIndex: 0 }),
    script: async ({ runtime, timeline, props, state, presentation }) => {
        const { faceLabels } = props

        const movePrediction = async (
            id: string,
            route: readonly GridCoordinate[]
        ): Promise<void> => {
            for (const position of route.slice(1)) {
                await runtime.moveCubeTo(id, position, {
                    duration: 0.48,
                    easing: 'easeInOutCubic',
                })
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

            presentation?.setTarget({
                zoom: 0.8,
                gridOpacity: 0.72,
                gridFadeInnerRadiusCells: 5,
                gridFadeOuterRadiusCells: 12,
            })
            await timeline.wait(0.7)

            const predictionIds = scenario.branches.map((branch, index) => {
                const id = `prediction-branch-${index}`
                const start = branch.route[0]
                if (start !== undefined) {
                    runtime.addCube({ id, position: start, opacity: 0, faceLabels })
                    void runtime
                        .fadeCubeTo(id, branch.successful ? 0.42 : 0.24, {
                            duration: 0.3,
                            easing: 'easeOutCubic',
                        })
                        .catch(() => undefined)
                }
                return id
            })

            await Promise.all(
                scenario.branches.map((branch, index) =>
                    movePrediction(predictionIds[index] ?? '', branch.route)
                )
            )
            await timeline.wait(0.75)

            const successfulIndex = scenario.branches.findIndex(
                (branch) => branch.successful
            )
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

            presentation?.setTarget({
                zoom: 1.08,
                gridOpacity: 0.48,
                gridFadeInnerRadiusCells: 3.5,
                gridFadeOuterRadiusCells: 12,
            })
            await timeline.wait(0.45)

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
            await timeline.wait(0.6)
        }

        await timeline.wait(0.6)
        await timeline.loop(async () => {
            const scenario = SCENARIOS[state.scenarioIndex]
            if (scenario === undefined) return
            await playScenario(scenario)
            state.scenarioIndex = (state.scenarioIndex + 1) % SCENARIOS.length
        })
    },
})
