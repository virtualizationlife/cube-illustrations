import { MAIN_CUBE_ID, type GridCoordinate } from '@runtime/grid/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.065
const CENTER: GridCoordinate = { column: 0, row: 0 }
const ATTRACTIVE_CUBE_IDS = [
    'valence-attractive-0',
    'valence-attractive-1',
    'valence-attractive-2',
    'valence-attractive-3',
] as const
const AVERSIVE_CUBE_IDS = [
    'valence-aversive-0',
    'valence-aversive-1',
    'valence-aversive-2',
    'valence-aversive-3',
] as const

const getFramePositions = (anchorColumn: number): readonly GridCoordinate[] => [
    { column: anchorColumn - 1, row: -1 },
    { column: anchorColumn - 1, row: 1 },
    { column: anchorColumn + 1, row: -1 },
    { column: anchorColumn + 1, row: 1 },
]

const getLinePositions = (anchorColumn: number): readonly GridCoordinate[] =>
    Array.from({ length: 4 }, (_, index) => ({
        column: anchorColumn - 1 + index,
        row: 1,
    }))

const BASE_PRESENTATION = {
    zoom: 0.98,
    gridOpacity: 0.5,
    gridFadeInnerRadiusCells: 2.5,
    gridFadeOuterRadiusCells: 9,
} as const

type ValenceFieldState = {
    attractionOnLeft: boolean
}

/** A cube remains near one form and retreats from another even after they swap sides. */
export const ValenceFieldScene = defineScene<CubeSceneProps, ValenceFieldState>({
    metadata: {
        primaryCategory: 'interaction',
        id: 'valence-field',
        title: 'Valence Field',
        tags: ['valence', 'behavior'],
        description: 'One shape draws the cube in, the other pushes it away.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 17,
        gridOpacity: BASE_PRESENTATION.gridOpacity,
        gridFadeInnerRadiusCells: BASE_PRESENTATION.gridFadeInnerRadiusCells,
        gridFadeOuterRadiusCells: BASE_PRESENTATION.gridFadeOuterRadiusCells,
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    presentation: BASE_PRESENTATION,
    setup: ({ runtime, props }) => {
        runtime.setCubePosition(MAIN_CUBE_ID, CENTER)
        const attractivePositions = getFramePositions(-3)
        const aversivePositions = getLinePositions(3)
        ATTRACTIVE_CUBE_IDS.forEach((id, index) => {
            const position = attractivePositions[index]
            if (position !== undefined) {
                runtime.addCube({ id, position, faceLabels: props.faceLabels })
            }
        })
        AVERSIVE_CUBE_IDS.forEach((id, index) => {
            const position = aversivePositions[index]
            if (position !== undefined) {
                runtime.addCube({ id, position, faceLabels: props.faceLabels })
            }
        })
        return { attractionOnLeft: true }
    },
    script: async ({ runtime, timeline, props, state, presentation }) => {
        const addGroup = (
            ids: readonly string[],
            positions: readonly GridCoordinate[],
            opacity = 1
        ): void => {
            ids.forEach((id, index) => {
                const position = positions[index]
                if (position !== undefined) {
                    runtime.addCube({
                        id,
                        position,
                        opacity,
                        faceLabels: props.faceLabels,
                    })
                }
            })
        }

        const removeGroup = (ids: readonly string[]): void => {
            ids.forEach((id) => {
                runtime.removeCube(id)
            })
        }

        const swapGroups = async (): Promise<void> => {
            const allIds = [...ATTRACTIVE_CUBE_IDS, ...AVERSIVE_CUBE_IDS]
            await Promise.all(
                allIds.map((id) =>
                    runtime.fadeCubeTo(id, 0, { duration: 0.4, easing: 'easeOutCubic' })
                )
            )
            removeGroup(allIds)
            state.attractionOnLeft = !state.attractionOnLeft
            const attractiveColumn = state.attractionOnLeft ? -3 : 3
            const aversiveColumn = state.attractionOnLeft ? 3 : -3
            addGroup(ATTRACTIVE_CUBE_IDS, getFramePositions(attractiveColumn), 0)
            addGroup(AVERSIVE_CUBE_IDS, getLinePositions(aversiveColumn), 0)
            await Promise.all(
                allIds.map((id) =>
                    runtime.fadeCubeTo(id, 1, { duration: 0.42, easing: 'easeOutCubic' })
                )
            )
        }

        const visitAttraction = async (): Promise<void> => {
            const anchor = state.attractionOnLeft ? -3 : 3
            const direction = Math.sign(anchor)
            presentation?.setTarget({
                zoom: 1.16,
                gridOpacity: 0.62,
                gridFadeInnerRadiusCells: 1.5,
                gridFadeOuterRadiusCells: 9,
            })
            const orbit: readonly GridCoordinate[] = [
                { column: anchor - direction * 2, row: 0 },
                { column: anchor, row: -2 },
                { column: anchor + direction * 2, row: 0 },
                { column: anchor, row: 2 },
                { column: anchor - direction * 2, row: 0 },
            ]
            for (const position of orbit) {
                await runtime.moveCubeTo(MAIN_CUBE_ID, position, {
                    duration: 0.48,
                    easing: 'easeInOutCubic',
                })
            }
            await timeline.wait(0.65)
            await runtime.moveCubeTo(MAIN_CUBE_ID, CENTER, {
                duration: 0.62,
                easing: 'easeInOutCubic',
            })
        }

        const approachAndAvoid = async (): Promise<void> => {
            const anchor = state.attractionOnLeft ? 3 : -3
            const direction = Math.sign(anchor)
            presentation?.setTarget({
                zoom: 0.84,
                gridOpacity: 0.36,
                gridFadeInnerRadiusCells: 3,
                gridFadeOuterRadiusCells: 9,
            })
            await runtime.moveCubeTo(
                MAIN_CUBE_ID,
                { column: anchor - direction * 2, row: 0 },
                { duration: 0.55, easing: 'easeInOutCubic' }
            )
            await timeline.wait(0.65)
            await runtime.moveCubeTo(
                MAIN_CUBE_ID,
                { column: -direction, row: -2 },
                { duration: 0.48, easing: 'easeOutCubic' }
            )
            await runtime.moveCubeTo(MAIN_CUBE_ID, CENTER, {
                duration: 0.4,
                easing: 'easeInOutCubic',
            })
        }

        await timeline.wait(0.8)
        await timeline.loop(async () => {
            await visitAttraction()
            await approachAndAvoid()
            await timeline.wait(0.55)
            await swapGroups()
            await timeline.wait(0.75)
        })
    },
})
