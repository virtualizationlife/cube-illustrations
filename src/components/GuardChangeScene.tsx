import { MAIN_CUBE_ID, type GridCoordinate } from '../scenes/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '../sdk/defineScene'

const GRID_CELL_SIZE = 0.06
const RELIEF_CUBE_ID = 'guard-relief'
const POST: GridCoordinate = { column: 0, row: 0 }
const WAITING_CELL: GridCoordinate = { column: 2, row: 0 }
const ENTRY: GridCoordinate = { column: 6, row: 0 }
const EXIT: GridCoordinate = { column: -6, row: 0 }
const EMPTY_POST_HOLD_S = 1.15

const HELD_PRESENTATION = {
    zoom: 1,
    gridOpacity: 0.55,
    gridFadeInnerRadiusCells: 2.5,
    gridFadeOuterRadiusCells: 9,
} as const

const EMPTY_PRESENTATION = {
    zoom: 0.88,
    gridOpacity: 0.26,
    gridFadeInnerRadiusCells: 1.5,
    gridFadeOuterRadiusCells: 9,
} as const

interface GuardChangeState {
    onPostId: string
    reliefId: string
    handoverCount: number
}

/** A post outlives its holders, alternating handovers that overlap and handovers that leave a gap. */
export const GuardChangeScene = defineScene<CubeSceneProps, GuardChangeState>({
    metadata: {
        id: 'changing-of-the-guard',
        title: 'Changing of the Guard',
        tags: ['continuity', 'handover'],
        description: 'A post outlives the cubes that hold it.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 17,
        gridOpacity: HELD_PRESENTATION.gridOpacity,
        gridFadeInnerRadiusCells: HELD_PRESENTATION.gridFadeInnerRadiusCells,
        gridFadeOuterRadiusCells: HELD_PRESENTATION.gridFadeOuterRadiusCells,
        cameraAzimuthDeg: 30,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    presentation: HELD_PRESENTATION,
    setup: ({ runtime, props }) => {
        runtime.setCubePosition(MAIN_CUBE_ID, POST)
        runtime.addCube({
            id: RELIEF_CUBE_ID,
            position: ENTRY,
            opacity: 0,
            faceLabels: props.faceLabels,
        })
        return {
            onPostId: MAIN_CUBE_ID,
            reliefId: RELIEF_CUBE_ID,
            handoverCount: 0,
        }
    },
    script: async ({ runtime, timeline, state, presentation }) => {
        const leavePost = async (): Promise<void> => {
            await Promise.all([
                runtime.moveCubeTo(state.onPostId, EXIT, {
                    duration: 1.1,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(state.onPostId, 0, {
                    duration: 1.1,
                    easing: 'easeOutCubic',
                }),
            ])
        }

        const takePost = async (from: GridCoordinate): Promise<void> => {
            runtime.setCubePosition(state.reliefId, from)
            await Promise.all([
                runtime.moveCubeTo(state.reliefId, POST, {
                    duration: 0.95,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(state.reliefId, 1, {
                    duration: 0.7,
                    easing: 'easeOutCubic',
                }),
            ])
        }

        /** The relief is already standing beside the post before the post is given up. */
        const handoverWithOverlap = async (): Promise<void> => {
            runtime.setCubePosition(state.reliefId, ENTRY)
            await Promise.all([
                runtime.moveCubeTo(state.reliefId, WAITING_CELL, {
                    duration: 1,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(state.reliefId, 1, {
                    duration: 0.8,
                    easing: 'easeOutCubic',
                }),
            ])
            await timeline.wait(0.85)
            await leavePost()
            await runtime.moveCubeTo(state.reliefId, POST, {
                duration: 0.5,
                easing: 'easeInOutCubic',
            })
        }

        /** Nobody holds the post for a moment, and the world visibly loosens its grip. */
        const handoverWithGap = async (): Promise<void> => {
            await leavePost()
            presentation?.setTarget(EMPTY_PRESENTATION)
            await timeline.wait(EMPTY_POST_HOLD_S)
            presentation?.setTarget(HELD_PRESENTATION)
            await takePost(ENTRY)
        }

        await timeline.wait(0.9)
        await timeline.loop(async () => {
            const departingId = state.onPostId
            state.handoverCount += 1
            if (state.handoverCount % 2 === 1) await handoverWithOverlap()
            else await handoverWithGap()

            runtime.setCubePosition(departingId, ENTRY)
            state.onPostId = state.reliefId
            state.reliefId = departingId
            await timeline.wait(0.9)
        })
    },
})
