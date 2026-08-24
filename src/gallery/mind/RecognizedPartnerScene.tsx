import { MAIN_CUBE_ID, type GridCoordinate } from '@runtime/grid/gridSceneRuntime'
import { defineScene } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.047
const PARTNER_ID = 'recognized-partner'
const OTHER_ID = 'recognized-other'
const PARTNER_START: GridCoordinate = { column: -7, row: 0 }
const OTHER_START: GridCoordinate = { column: 7, row: 0 }
const MEMORY_POSITIONS: readonly GridCoordinate[] = [
    { column: -1, row: 0 },
    { column: 0, row: 1 },
    { column: 1, row: 1 },
    { column: 1, row: 0 },
]
const MEMORY_IDS = MEMORY_POSITIONS.map((_, index) => `recognized-memory-${index}`)
const BACKGROUND_POSITIONS: readonly GridCoordinate[] = [
    { column: -5, row: -5 },
    { column: -3, row: 5 },
    { column: 3, row: -5 },
    { column: 5, row: 5 },
]

const BASE_PRESENTATION = {
    zoom: 1,
    gridOpacity: 0.5,
    gridFadeInnerRadiusCells: 3,
    gridFadeOuterRadiusCells: 10,
} as const

type PairedStep = {
    readonly main: GridCoordinate
    readonly partner: GridCoordinate
}

const FIRST_ROUTINE: readonly PairedStep[] = [
    { main: { column: 0, row: 1 }, partner: { column: 0, row: 0 } },
    { main: { column: 1, row: 1 }, partner: { column: 0, row: 1 } },
    { main: { column: 1, row: 0 }, partner: { column: 1, row: 1 } },
    { main: { column: 0, row: 0 }, partner: { column: 1, row: 0 } },
]

const SECOND_ROUTINE: readonly PairedStep[] = [
    { main: { column: 1, row: 1 }, partner: { column: 1, row: 0 } },
    { main: { column: 2, row: 1 }, partner: { column: 1, row: 1 } },
    { main: { column: 2, row: 0 }, partner: { column: 2, row: 1 } },
    { main: { column: 1, row: 0 }, partner: { column: 2, row: 0 } },
]

/** A cube recognizes its previous partner after two identical visitors exchange places. */
export const RecognizedPartnerScene = defineScene({
    metadata: {
        primaryCategory: 'mind',
        id: 'recognized-partner',
        title: 'Recognized Partner',
        tags: ['identity', 'memory', 'relationship'],
        description: 'One of two identical visitors is recognised as the partner.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 21,
        gridOpacity: BASE_PRESENTATION.gridOpacity,
        gridFadeInnerRadiusCells: BASE_PRESENTATION.gridFadeInnerRadiusCells,
        gridFadeOuterRadiusCells: BASE_PRESENTATION.gridFadeOuterRadiusCells,
        cameraAzimuthDeg: 25,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    presentation: BASE_PRESENTATION,
    setup: ({ runtime, props }) => {
        const { faceLabels } = props
        runtime.setCubePosition(MAIN_CUBE_ID, { column: 0, row: 0 })
        runtime.addCube({ id: PARTNER_ID, position: PARTNER_START, faceLabels })
        runtime.addCube({ id: OTHER_ID, position: OTHER_START, faceLabels })
        BACKGROUND_POSITIONS.forEach((position, index) => {
            runtime.addCube({
                id: `recognized-background-${index}`,
                position,
                faceLabels,
            })
        })
        MEMORY_POSITIONS.forEach((position, index) => {
            const id = MEMORY_IDS[index]
            if (id === undefined) return
            runtime.addCube({
                id,
                position,
                opacity: 0,
                hoverCells: 0.04,
                occupiesCell: false,
                faceLabels,
            })
        })
    },
    script: async ({ runtime, timeline, presentation }) => {
        const move = (cubeId: string, position: GridCoordinate, duration = 0.44): Promise<void> =>
            runtime.moveCubeTo(cubeId, position, {
                duration,
                easing: 'easeInOutCubic',
            })

        const setStart = (): void => {
            runtime.setCubePosition(MAIN_CUBE_ID, { column: 0, row: 0 })
            runtime.setCubePosition(PARTNER_ID, PARTNER_START)
            runtime.setCubePosition(OTHER_ID, OTHER_START)
        }

        const fadeMemories = (opacity: number, duration: number): Promise<unknown> =>
            Promise.all(
                MEMORY_IDS.map((id) =>
                    runtime.fadeCubeTo(id, opacity, {
                        duration,
                        easing: 'easeOutCubic',
                    })
                )
            )

        const playRoutine = async (
            steps: readonly PairedStep[],
            writeMemory: boolean
        ): Promise<void> => {
            for (let index = 0; index < steps.length; index += 1) {
                const step = steps[index]
                if (step === undefined) continue
                await move(MAIN_CUBE_ID, step.main)
                await move(PARTNER_ID, step.partner)
                if (writeMemory) {
                    const memoryId = MEMORY_IDS[index]
                    if (memoryId !== undefined) {
                        await runtime.fadeCubeTo(memoryId, 0.16, {
                            duration: 0.22,
                            easing: 'easeOutCubic',
                        })
                    }
                }
                await timeline.wait(0.12)
            }
        }

        const swapVisitors = async (): Promise<void> => {
            await Promise.all([
                move(PARTNER_ID, { column: 0, row: -4 }, 0.72),
                move(OTHER_ID, { column: 0, row: 4 }, 0.72),
            ])
            await Promise.all([
                move(PARTNER_ID, { column: 7, row: 0 }, 0.9),
                move(OTHER_ID, { column: -7, row: 0 }, 0.9),
            ])
        }

        const reset = async (): Promise<void> => {
            await Promise.all([
                runtime.fadeCubeTo(MAIN_CUBE_ID, 0, { duration: 0.36, easing: 'linear' }),
                runtime.fadeCubeTo(PARTNER_ID, 0, { duration: 0.36, easing: 'linear' }),
                runtime.fadeCubeTo(OTHER_ID, 0, { duration: 0.36, easing: 'linear' }),
                fadeMemories(0, 0.36),
            ])
            setStart()
            presentation?.setTarget({ zoom: 1, gridOpacity: 0.5 })
            await Promise.all([
                runtime.fadeCubeTo(MAIN_CUBE_ID, 1, {
                    duration: 0.4,
                    easing: 'easeOutCubic',
                }),
                runtime.fadeCubeTo(PARTNER_ID, 1, {
                    duration: 0.4,
                    easing: 'easeOutCubic',
                }),
                runtime.fadeCubeTo(OTHER_ID, 1, {
                    duration: 0.4,
                    easing: 'easeOutCubic',
                }),
            ])
        }

        await timeline.wait(0.9)
        await timeline.loop(async () => {
            await move(PARTNER_ID, { column: -1, row: 0 }, 0.9)
            await timeline.wait(0.45)
            await playRoutine(FIRST_ROUTINE, true)
            await move(PARTNER_ID, { column: -5, row: 0 }, 0.76)
            await timeline.wait(0.5)

            await swapVisitors()
            await timeline.wait(0.7)
            await Promise.all([
                move(PARTNER_ID, { column: 2, row: 0 }, 0.78),
                move(OTHER_ID, { column: -2, row: 0 }, 0.78),
            ])
            presentation?.setTarget({ zoom: 1.2, gridOpacity: 0.66 })
            await fadeMemories(0.42, 0.42)
            await move(MAIN_CUBE_ID, { column: 1, row: 0 }, 0.46)
            await playRoutine(SECOND_ROUTINE, false)
            await fadeMemories(0.18, 0.36)
            await timeline.wait(1.3)
            await reset()
            await timeline.wait(0.65)
        })
    },
})
