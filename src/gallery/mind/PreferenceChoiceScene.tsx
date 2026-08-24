import { GRID_PRESETS } from '@runtime/animation/motion'
import { MAIN_CUBE_ID, type GridCoordinate } from '@runtime/grid/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = GRID_PRESETS.corridor.gridCellSize
const START_POSITIONS: readonly GridCoordinate[] = [
    { column: 0, row: -4 },
    { column: 0, row: 0 },
    { column: 0, row: 4 },
]
const PREFERRED_CUBE_IDS = [
    'preference-frame-0',
    'preference-frame-1',
    'preference-frame-2',
    'preference-frame-3',
] as const
const ALTERNATIVE_CUBE_IDS = [
    'preference-line-0',
    'preference-line-1',
    'preference-line-2',
    'preference-line-3',
] as const
const SWAP_STAGING_POSITIONS: readonly GridCoordinate[] = [
    { column: -4, row: 5 },
    { column: -1, row: 5 },
    { column: 1, row: 5 },
    { column: 4, row: 5 },
]

const getFramePositions = (anchorColumn: number): readonly GridCoordinate[] => [
    { column: anchorColumn - 1, row: -1 },
    { column: anchorColumn - 1, row: 1 },
    { column: anchorColumn + 1, row: -1 },
    { column: anchorColumn + 1, row: 1 },
]

const getLinePositions = (anchorColumn: number): readonly GridCoordinate[] =>
    Array.from({ length: 4 }, (_, index) => ({
        column: anchorColumn - 2 + index,
        row: 1,
    }))

type PreferenceChoiceState = {
    previousStartIndex: number
    preferredOnLeft: boolean
}

/** A cube follows its preferred shape even when the two destination shapes swap sides. */
export const PreferenceChoiceScene = defineScene<CubeSceneProps, PreferenceChoiceState>({
    metadata: {
        primaryCategory: 'mind',
        id: 'repeated-preference',
        title: 'Repeated Preference',
        tags: ['mind', 'preference'],
        description: 'The same shape is chosen however the options are arranged.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: GRID_PRESETS.corridor.gridCellCount,
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        const start = START_POSITIONS[0]
        if (start !== undefined) runtime.setCubePosition(MAIN_CUBE_ID, start)
        const preferredPositions = getFramePositions(-3)
        const alternativePositions = getLinePositions(3)
        PREFERRED_CUBE_IDS.forEach((id, index) => {
            const position = preferredPositions[index]
            if (position !== undefined) {
                runtime.addCube({ id, position, faceLabels: props.faceLabels })
            }
        })
        ALTERNATIVE_CUBE_IDS.forEach((id, index) => {
            const position = alternativePositions[index]
            if (position !== undefined) {
                runtime.addCube({ id, position, faceLabels: props.faceLabels })
            }
        })
        return { previousStartIndex: 0, preferredOnLeft: true }
    },
    script: async ({ runtime, timeline, random, state }) => {
        const moveGroup = async (
            cubeIds: readonly string[],
            positions: readonly GridCoordinate[]
        ): Promise<void> => {
            for (let index = 0; index < cubeIds.length; index += 1) {
                const cubeId = cubeIds[index]
                const position = positions[index]
                if (cubeId === undefined || position === undefined) continue
                await runtime.moveCubeTo(cubeId, position, {
                    duration: 0.34,
                    easing: 'easeInOutCubic',
                })
                await timeline.wait(0.04)
            }
        }

        const swapDestinations = async (): Promise<void> => {
            const preferredTargetColumn = state.preferredOnLeft ? 3 : -3
            const alternativeTargetColumn = state.preferredOnLeft ? -3 : 3
            await moveGroup(ALTERNATIVE_CUBE_IDS, SWAP_STAGING_POSITIONS)
            await moveGroup(PREFERRED_CUBE_IDS, getFramePositions(preferredTargetColumn))
            await moveGroup(ALTERNATIVE_CUBE_IDS, getLinePositions(alternativeTargetColumn))
            state.preferredOnLeft = !state.preferredOnLeft
        }

        await timeline.wait(0.9)
        await timeline.loop(async () => {
            const preferredPosition = {
                column: state.preferredOnLeft ? -3 : 3,
                row: 0,
            }
            await runtime.moveCubeTo(MAIN_CUBE_ID, preferredPosition, {
                duration: 0.85,
                easing: 'easeInOutCubic',
            })
            await timeline.wait(1.15)

            const nextStartIndex = random.differentIndex(
                START_POSITIONS.length,
                state.previousStartIndex
            )
            const nextStart = START_POSITIONS[nextStartIndex]
            if (nextStart === undefined) return
            await runtime.moveCubeTo(MAIN_CUBE_ID, nextStart, {
                duration: 0.9,
                easing: 'easeInOutCubic',
            })
            state.previousStartIndex = nextStartIndex
            await timeline.wait(0.55)
            await swapDestinations()
            await timeline.wait(0.9)
        })
    },
})
