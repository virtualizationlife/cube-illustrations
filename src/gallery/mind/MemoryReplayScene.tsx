import { MAIN_CUBE_ID, type GridCoordinate } from '@runtime/grid/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.045
const MEMORY_ECHO_OPACITIES = [0.38, 0.27, 0.18] as const
const JOURNEY: readonly GridCoordinate[] = [
    { column: -4, row: -2 },
    { column: -2, row: -2 },
    { column: -2, row: 1 },
    { column: 0, row: 1 },
    { column: 0, row: -1 },
    { column: 3, row: -1 },
    { column: 3, row: 2 },
]
const OBSERVER_POSITION: GridCoordinate = { column: 4, row: 4 }

type MemoryEcho = {
    readonly id: string
    pathIndex: number
}

/** A traveled route is replayed by a delayed cascade of translucent memory cubes. */
export const MemoryReplayScene = defineScene({
    metadata: {
        primaryCategory: 'mind',
        id: 'memory-replay',
        title: 'Memory Replay',
        tags: ['mind', 'memory'],
        description: 'A route is replayed by a cascade of translucent echoes.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 15,
        gridFadeInnerRadiusCells: 2,
        gridFadeOuterRadiusCells: 8,
        cameraAzimuthDeg: 35,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime }) => {
        const start = JOURNEY[0]
        if (start !== undefined) runtime.setCubePosition(MAIN_CUBE_ID, start)
    },
    script: async ({ runtime, timeline, props }) => {
        const replayJourney = async (): Promise<void> => {
            const echoes: MemoryEcho[] = []
            let spawnedEchoCount = 0

            while (echoes.length > 0 || spawnedEchoCount < MEMORY_ECHO_OPACITIES.length) {
                const completedEchoes = echoes.filter(
                    (echo) => echo.pathIndex >= JOURNEY.length - 1
                )
                await Promise.all(
                    completedEchoes.map((echo) =>
                        runtime.fadeCubeTo(echo.id, 0, {
                            duration: 0.35,
                            easing: 'easeOutCubic',
                        })
                    )
                )
                for (const echo of completedEchoes) {
                    runtime.removeCube(echo.id)
                    echoes.splice(echoes.indexOf(echo), 1)
                }

                for (const echo of [...echoes].sort(
                    (left, right) => right.pathIndex - left.pathIndex
                )) {
                    const nextPosition = JOURNEY[echo.pathIndex + 1]
                    if (nextPosition === undefined) continue
                    await runtime.moveCubeTo(echo.id, nextPosition, {
                        duration: 0.46,
                        easing: 'easeInOutCubic',
                    })
                    echo.pathIndex += 1
                }

                if (spawnedEchoCount < MEMORY_ECHO_OPACITIES.length) {
                    const start = JOURNEY[0]
                    const opacity = MEMORY_ECHO_OPACITIES[spawnedEchoCount]
                    if (start !== undefined && opacity !== undefined) {
                        const id = `memory-echo-${spawnedEchoCount}`
                        runtime.addCube({
                            id,
                            position: start,
                            opacity: 0,
                            faceLabels: props.faceLabels,
                        })
                        await runtime.fadeCubeTo(id, opacity, {
                            duration: 0.28,
                            easing: 'easeOutCubic',
                        })
                        echoes.push({ id, pathIndex: 0 })
                        spawnedEchoCount += 1
                    }
                }

                const reachedSignificantPosition = echoes.some((echo) => echo.pathIndex === 3)
                await timeline.wait(reachedSignificantPosition ? 0.65 : 0.18)
            }
        }

        await timeline.wait(0.8)
        await timeline.loop(async () => {
            for (const position of JOURNEY.slice(1)) {
                await runtime.moveCubeTo(MAIN_CUBE_ID, position, {
                    duration: 0.62,
                    easing: 'easeInOutCubic',
                })
                await timeline.wait(0.12)
            }

            await runtime.moveCubeTo(MAIN_CUBE_ID, OBSERVER_POSITION, {
                duration: 0.7,
                easing: 'easeInOutCubic',
            })

            await replayJourney()
            await runtime.moveCubeTo(MAIN_CUBE_ID, JOURNEY[0], {
                duration: 0.9,
                easing: 'easeInOutCubic',
            })
            await timeline.wait(0.7)
        })
    },
})
