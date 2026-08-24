import { MAIN_CUBE_ID, type GridCoordinate } from '@runtime/grid/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.07
const RHYTHM_CUBE_ID = 'learned-rhythm-cube'
const MAIN_ENTRY: GridCoordinate = { column: -5, row: 0 }
const MAIN_START: GridCoordinate = { column: -4, row: 0 }
const MAIN_WAIT: GridCoordinate = { column: -1, row: 0 }
const MAIN_EXIT: GridCoordinate = { column: 5, row: 0 }
const RHYTHM_ENTRY: GridCoordinate = { column: 0, row: -5 }
const RHYTHM_START: GridCoordinate = { column: 0, row: -4 }
const RHYTHM_CENTER: GridCoordinate = { column: 0, row: 0 }
const RHYTHM_END: GridCoordinate = { column: 0, row: 4 }
const RHYTHM_EXIT: GridCoordinate = { column: 0, row: 5 }

const BASE_PRESENTATION = {
    zoom: 1,
    gridOpacity: 0.58,
    gridFadeInnerRadiusCells: 2,
    gridFadeOuterRadiusCells: 8,
} as const

type LearnedRhythmState = {
    observedPassCount: number
}

/** A cube learns another cube's crossing rhythm and uses the predictable pause. */
export const LearnedRhythmScene = defineScene<CubeSceneProps, LearnedRhythmState>({
    metadata: {
        primaryCategory: 'mind',
        id: 'learned-rhythm',
        title: 'Learned Rhythm',
        tags: ['others', 'anticipation'],
        description: "Another cube's rhythm is learned and its pause is used.",
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 15,
        gridOpacity: BASE_PRESENTATION.gridOpacity,
        gridFadeInnerRadiusCells: BASE_PRESENTATION.gridFadeInnerRadiusCells,
        gridFadeOuterRadiusCells: BASE_PRESENTATION.gridFadeOuterRadiusCells,
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    presentation: BASE_PRESENTATION,
    setup: ({ runtime, props }) => {
        runtime.setCubePosition(MAIN_CUBE_ID, MAIN_ENTRY)
        runtime.setCubeOpacity(MAIN_CUBE_ID, 0)
        runtime.addCube({
            id: RHYTHM_CUBE_ID,
            position: RHYTHM_ENTRY,
            opacity: 0,
            faceLabels: props.faceLabels,
        })
        return { observedPassCount: 2 }
    },
    script: async ({ runtime, timeline, state, presentation }) => {
        const enterCube = async (
            cubeId: string,
            entry: GridCoordinate,
            visiblePosition: GridCoordinate
        ): Promise<void> => {
            runtime.setCubePosition(cubeId, entry)
            runtime.setCubeOpacity(cubeId, 0)
            await Promise.all([
                runtime.moveCubeTo(cubeId, visiblePosition, {
                    duration: 0.34,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(cubeId, 1, {
                    duration: 0.34,
                    easing: 'easeOutCubic',
                }),
            ])
        }

        const exitCube = async (cubeId: string, exit: GridCoordinate): Promise<void> => {
            await Promise.all([
                runtime.moveCubeTo(cubeId, exit, {
                    duration: 0.34,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(cubeId, 0, {
                    duration: 0.34,
                    easing: 'easeOutCubic',
                }),
            ])
        }

        const rhythmPass = async (): Promise<void> => {
            await enterCube(RHYTHM_CUBE_ID, RHYTHM_ENTRY, RHYTHM_START)
            await runtime.moveCubeTo(RHYTHM_CUBE_ID, RHYTHM_END, {
                duration: 0.72,
                easing: 'easeInOutCubic',
            })
            await exitCube(RHYTHM_CUBE_ID, RHYTHM_EXIT)
        }

        const showConflict = async (): Promise<void> => {
            presentation?.setTarget({
                zoom: 1.22,
                gridOpacity: 0.72,
                gridFadeInnerRadiusCells: 1.5,
                gridFadeOuterRadiusCells: 8,
            })
            await Promise.all([
                enterCube(MAIN_CUBE_ID, MAIN_ENTRY, MAIN_START),
                enterCube(RHYTHM_CUBE_ID, RHYTHM_ENTRY, RHYTHM_START),
            ])
            await Promise.all([
                runtime.moveCubeTo(MAIN_CUBE_ID, MAIN_WAIT, {
                    duration: 0.52,
                    easing: 'easeInOutCubic',
                }),
                runtime.moveCubeTo(RHYTHM_CUBE_ID, RHYTHM_CENTER, {
                    duration: 0.52,
                    easing: 'easeInOutCubic',
                }),
            ])
            await timeline.wait(0.7)
            await runtime.moveCubeTo(RHYTHM_CUBE_ID, RHYTHM_END, {
                duration: 0.42,
                easing: 'easeInOutCubic',
            })
            await exitCube(RHYTHM_CUBE_ID, RHYTHM_EXIT)
            await runtime.moveCubeTo(
                MAIN_CUBE_ID,
                { column: 4, row: 0 },
                {
                    duration: 0.72,
                    easing: 'easeInOutCubic',
                }
            )
            await exitCube(MAIN_CUBE_ID, MAIN_EXIT)
        }

        const showLearnedTiming = async (): Promise<void> => {
            presentation?.setTarget({
                zoom: 0.9,
                gridOpacity: 0.48,
                gridFadeInnerRadiusCells: 2.5,
                gridFadeOuterRadiusCells: 8,
            })
            await enterCube(MAIN_CUBE_ID, MAIN_ENTRY, MAIN_START)
            for (let pass = 0; pass < state.observedPassCount; pass += 1) {
                await rhythmPass()
                await timeline.wait(0.16)
            }

            await timeline.wait(0.55)
            presentation?.setTarget({ zoom: 1.03, gridOpacity: 0.55 })
            await runtime.moveCubeTo(
                MAIN_CUBE_ID,
                { column: 4, row: 0 },
                {
                    duration: 0.8,
                    easing: 'easeInOutCubic',
                }
            )
            await exitCube(MAIN_CUBE_ID, MAIN_EXIT)
            state.observedPassCount = state.observedPassCount === 2 ? 1 : 2
        }

        await timeline.wait(0.7)
        await timeline.loop(async () => {
            await showConflict()
            await timeline.wait(0.55)
            await showLearnedTiming()
            await timeline.wait(0.75)
        })
    },
})
