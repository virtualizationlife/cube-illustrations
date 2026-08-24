import type { GridCubeFaceLabelInput } from '../scenes/cubeFaceLabels'
import {
    MAIN_CUBE_ID,
    type GridCoordinate,
    type GridSceneRuntime,
} from '../scenes/gridSceneRuntime'
import type { ScenePresentationController } from '../scenes/scenePresentation'
import { defineScene } from '../sdk/defineScene'

const GRID_CELL_SIZE = 0.032
const BASE_PRESENTATION = {
    zoom: 0.96,
    gridOpacity: 0.52,
    gridFadeInnerRadiusCells: 4,
    gridFadeOuterRadiusCells: 17,
} as const
const ORIGIN: GridCoordinate = { column: 0, row: 0 }
const PREVIEW_CUBE_ID = 'history-preview'
const COMPANION_CUBE_ID = 'history-companion'
const NORTH_TRAVELER_IDS = ['history-north-traveler-0', 'history-north-traveler-1'] as const
const FLOW_CUBE_IDS = ['history-flow-0', 'history-flow-1', 'history-flow-2'] as const
const GROUP_CUBE_IDS = [
    'history-group-left',
    'history-group-near',
    'history-group-right',
    'history-group-far',
] as const
const TRACE_CUBE_IDS = Array.from({ length: 12 }, (_, index) => `history-trace-${index}`)

const EAST_WALL: readonly GridCoordinate[] = [-3, -2, -1, 0, 1, 2].map((row) => ({
    column: 8,
    row,
}))
const EAST_GATE: readonly GridCoordinate[] = [
    { column: 13, row: -1 },
    { column: 13, row: 2 },
]
const NORTH_WALL: readonly GridCoordinate[] = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3].map(
    (column) => ({ column, row: 9 })
)
const SOUTH_GATE: readonly GridCoordinate[] = [
    { column: -2, row: -12 },
    { column: -1, row: -12 },
    { column: 1, row: -12 },
    { column: 2, row: -12 },
]
const COMPANION_START: GridCoordinate = { column: 4, row: 1 }
const NORTH_TRAVELER_STARTS: readonly GridCoordinate[] = [
    { column: -7, row: 14 },
    { column: -8, row: 14 },
]
const FLOW_STARTS: readonly GridCoordinate[] = [
    { column: -8, row: -8 },
    { column: -5, row: -8 },
    { column: -2, row: -8 },
]
const GROUP_STARTS: readonly GridCoordinate[] = [
    { column: -1, row: -17 },
    { column: 0, row: -16 },
    { column: 1, row: -17 },
    { column: 0, row: -18 },
]
const STORY_TRACES: readonly (readonly GridCoordinate[])[] = [
    [
        { column: 4, row: 0 },
        { column: 8, row: 3 },
        { column: 13, row: 1 },
        { column: 17, row: 0 },
    ],
    [
        { column: -5, row: 5 },
        { column: -7, row: 9 },
        { column: -7, row: 13 },
        { column: -7, row: 17 },
    ],
    [
        { column: 0, row: -5 },
        { column: 0, row: -9 },
        { column: 0, row: -13 },
        { column: 0, row: -17 },
    ],
]

const runHistorySplit = async (
    runtime: GridSceneRuntime,
    delay: (durationSeconds: number) => Promise<void>,
    presentation: ScenePresentationController | null
): Promise<void> => {
    const move = (cubeId: string, position: GridCoordinate, duration = 0.52): Promise<void> =>
        runtime.moveCubeTo(cubeId, position, {
            duration,
            easing: 'easeInOutCubic',
        })

    const travel = (position: GridCoordinate, duration = 0.72): Promise<void> =>
        runtime.travelWithCube(MAIN_CUBE_ID, position, {
            duration,
            easing: 'easeInOutCubic',
        })

    const setPositions = (ids: readonly string[], positions: readonly GridCoordinate[]): void => {
        ids.forEach((id, index) => {
            const position = positions[index]
            if (position !== undefined) runtime.setCubePosition(id, position)
        })
    }

    const resetWorldActors = (): void => {
        runtime.setCubePosition(COMPANION_CUBE_ID, COMPANION_START)
        setPositions(NORTH_TRAVELER_IDS, NORTH_TRAVELER_STARTS)
        setPositions(FLOW_CUBE_IDS, FLOW_STARTS)
        setPositions(GROUP_CUBE_IDS, GROUP_STARTS)
    }

    const clearTraces = async (): Promise<void> => {
        await Promise.all(
            TRACE_CUBE_IDS.map((id) =>
                runtime.fadeCubeTo(id, 0, { duration: 0.35, easing: 'linear' })
            )
        )
    }

    const revealTrace = async (storyIndex: number): Promise<void> => {
        const positions = STORY_TRACES[storyIndex]
        if (positions === undefined) return
        const offset = storyIndex * 4
        positions.forEach((position, index) => {
            const cubeId = TRACE_CUBE_IDS[offset + index]
            if (cubeId !== undefined) runtime.setCubePosition(cubeId, position)
        })
        await Promise.all(
            positions.map((_, index) => {
                const cubeId = TRACE_CUBE_IDS[offset + index]
                return cubeId === undefined
                    ? Promise.resolve()
                    : runtime.fadeCubeTo(cubeId, 0.16, {
                          duration: 0.45,
                          easing: 'easeOutCubic',
                      })
            })
        )
    }

    const previewDirection = async (route: readonly GridCoordinate[]): Promise<void> => {
        runtime.setCubePosition(PREVIEW_CUBE_ID, ORIGIN)
        runtime.setCubeOpacity(PREVIEW_CUBE_ID, 0)
        await runtime.fadeCubeTo(PREVIEW_CUBE_ID, 0.28, {
            duration: 0.32,
            easing: 'easeOutCubic',
        })
        for (const position of route) {
            await move(PREVIEW_CUBE_ID, position, 0.3)
        }
        await delay(0.24)
    }

    const followPreview = async (position: GridCoordinate, duration = 0.9): Promise<void> => {
        await Promise.all([
            travel(position, duration),
            runtime.fadeCubeTo(PREVIEW_CUBE_ID, 0, {
                duration: Math.min(duration, 0.65),
                easing: 'linear',
            }),
        ])
    }

    const returnToOrigin = async (): Promise<void> => {
        await runtime.fadeCubeTo(MAIN_CUBE_ID, 0, {
            duration: 0.42,
            easing: 'linear',
        })
        runtime.setCubePosition(MAIN_CUBE_ID, ORIGIN)
        resetWorldActors()
        await runtime.moveGridFocusTo(ORIGIN, {
            duration: 0.9,
            easing: 'easeInOutCubic',
        })
        await runtime.fadeCubeTo(MAIN_CUBE_ID, 1, {
            duration: 0.4,
            easing: 'easeOutCubic',
        })
        await delay(0.42)
    }

    const playCompanionHistory = async (): Promise<void> => {
        await previewDirection([
            { column: 1, row: 0 },
            { column: 2, row: 0 },
            { column: 3, row: 0 },
            { column: 4, row: 0 },
        ])
        await followPreview({ column: 4, row: 0 }, 1.15)
        await delay(0.6)

        await Promise.all([
            move(COMPANION_CUBE_ID, { column: 5, row: 1 }),
            travel({ column: 5, row: 0 }),
        ])
        await Promise.all([
            move(COMPANION_CUBE_ID, { column: 6, row: 2 }),
            travel({ column: 6, row: 1 }),
        ])

        await move(COMPANION_CUBE_ID, { column: 7, row: 3 })
        await travel({ column: 6, row: 3 }, 0.5)
        await move(COMPANION_CUBE_ID, { column: 8, row: 3 })
        await travel({ column: 7, row: 3 }, 0.42)
        await move(COMPANION_CUBE_ID, { column: 9, row: 3 })
        await travel({ column: 8, row: 3 }, 0.42)
        await move(COMPANION_CUBE_ID, { column: 11, row: 1 }, 0.68)
        await travel({ column: 10, row: 1 }, 0.68)

        await move(COMPANION_CUBE_ID, { column: 12, row: 1 }, 0.4)
        await travel({ column: 11, row: 1 }, 0.4)
        await move(COMPANION_CUBE_ID, { column: 13, row: 1 }, 0.4)
        await travel({ column: 12, row: 1 }, 0.4)
        await move(COMPANION_CUBE_ID, { column: 15, row: 1 }, 0.55)
        await travel({ column: 14, row: 1 }, 0.55)
        await move(COMPANION_CUBE_ID, { column: 17, row: 2 }, 0.62)
        await travel({ column: 17, row: 0 }, 0.82)
        await revealTrace(0)
        await delay(1)
    }

    const playObstacleHistory = async (): Promise<void> => {
        await previewDirection([
            { column: -1, row: 1 },
            { column: -2, row: 2 },
            { column: -3, row: 3 },
            { column: -4, row: 4 },
            { column: -5, row: 5 },
        ])
        await followPreview({ column: -5, row: 5 }, 1.25)
        await travel({ column: -4, row: 8 }, 0.72)
        await delay(0.7)
        await travel({ column: -5, row: 8 }, 0.34)
        await travel({ column: -7, row: 8 }, 0.6)

        await Promise.all([
            move(NORTH_TRAVELER_IDS[0], { column: -7, row: 11 }, 0.72),
            move(NORTH_TRAVELER_IDS[1], { column: -8, row: 11 }, 0.72),
        ])
        await delay(0.55)
        await Promise.all([
            move(NORTH_TRAVELER_IDS[0], { column: -6, row: 11 }, 0.4),
            move(NORTH_TRAVELER_IDS[1], { column: -9, row: 11 }, 0.4),
        ])

        await travel({ column: -7, row: 9 }, 0.4)
        await travel({ column: -7, row: 11 }, 0.48)
        await travel({ column: -7, row: 13 }, 0.48)
        await delay(0.38)
        await travel({ column: -6, row: 15 }, 0.56)
        await travel({ column: -7, row: 17 }, 0.56)
        await revealTrace(1)
        await delay(1)
    }

    const playGroupHistory = async (): Promise<void> => {
        await previewDirection([
            { column: 0, row: -1 },
            { column: 0, row: -2 },
            { column: 0, row: -3 },
            { column: 0, row: -4 },
            { column: 0, row: -5 },
        ])
        await followPreview({ column: 0, row: -5 }, 1.2)
        await delay(0.55)

        const flowTargets: readonly GridCoordinate[] = [
            { column: 8, row: -8 },
            { column: 5, row: -8 },
            { column: 2, row: -8 },
        ]
        for (let index = 0; index < FLOW_CUBE_IDS.length; index += 1) {
            const cubeId = FLOW_CUBE_IDS[index]
            const target = flowTargets[index]
            if (cubeId === undefined || target === undefined) continue
            await move(cubeId, target, 0.9)
        }

        await travel({ column: 0, row: -9 }, 0.72)
        await travel({ column: 0, row: -11 }, 0.52)
        await delay(0.42)
        await travel({ column: 0, row: -13 }, 0.52)
        await travel({ column: 0, row: -15 }, 0.52)
        await move(GROUP_CUBE_IDS[1], { column: -1, row: -16 }, 0.5)
        await travel({ column: 0, row: -17 }, 0.62)
        await revealTrace(2)
        await delay(1.1)
    }

    const showAllHistories = async (): Promise<void> => {
        await runtime.fadeCubeTo(MAIN_CUBE_ID, 0, {
            duration: 0.38,
            easing: 'linear',
        })
        runtime.setCubePosition(MAIN_CUBE_ID, ORIGIN)
        resetWorldActors()
        await runtime.moveGridFocusTo(ORIGIN, {
            duration: 0.9,
            easing: 'easeInOutCubic',
        })
        presentation?.setTarget({
            zoom: 0.62,
            gridOpacity: 0.42,
            gridFadeInnerRadiusCells: 6,
            gridFadeOuterRadiusCells: 20,
        })
        await runtime.fadeCubeTo(MAIN_CUBE_ID, 1, {
            duration: 0.42,
            easing: 'easeOutCubic',
        })
        await delay(2.4)
    }

    const play = async (): Promise<void> => {
        await delay(0.9)
        for (;;) {
            presentation?.setTarget({
                zoom: 0.96,
                gridOpacity: 0.52,
                gridFadeInnerRadiusCells: 4,
                gridFadeOuterRadiusCells: 17,
            })
            await clearTraces()
            await playCompanionHistory()
            await returnToOrigin()
            await playObstacleHistory()
            await returnToOrigin()
            await playGroupHistory()
            await showAllHistories()
            await clearTraces()
            await delay(0.5)
        }
    }

    await play()
}

const addWorldCube = (
    runtime: GridSceneRuntime,
    id: string,
    position: GridCoordinate,
    faceLabels: GridCubeFaceLabelInput | undefined
): void => {
    runtime.addCube({ id, position, faceLabels })
}

/** One unchanged world produces three different histories from the same starting point. */
export const HistorySplitScene = defineScene({
    metadata: {
        id: 'history-split',
        title: 'History Split',
        tags: ['continuity', 'biography', 'comparison'],
        description: 'One unchanged world produces different histories from one origin.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 39,
        gridOpacity: 0.52,
        gridFadeInnerRadiusCells: 4,
        gridFadeOuterRadiusCells: 17,
        cameraAzimuthDeg: 35,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    presentation: BASE_PRESENTATION,
    setup: ({ runtime, props }) => {
        const { faceLabels } = props
        runtime.setCubePosition(MAIN_CUBE_ID, ORIGIN)
        runtime.addCube({
            id: PREVIEW_CUBE_ID,
            position: ORIGIN,
            opacity: 0,
            hoverCells: 0.08,
            occupiesCell: false,
            faceLabels,
        })
        addWorldCube(runtime, COMPANION_CUBE_ID, COMPANION_START, faceLabels)
        EAST_WALL.forEach((position, index) => {
            addWorldCube(runtime, `history-east-wall-${index}`, position, faceLabels)
        })
        EAST_GATE.forEach((position, index) => {
            addWorldCube(runtime, `history-east-gate-${index}`, position, faceLabels)
        })
        NORTH_WALL.forEach((position, index) => {
            addWorldCube(runtime, `history-north-wall-${index}`, position, faceLabels)
        })
        SOUTH_GATE.forEach((position, index) => {
            addWorldCube(runtime, `history-south-gate-${index}`, position, faceLabels)
        })
        NORTH_TRAVELER_IDS.forEach((id, index) => {
            const position = NORTH_TRAVELER_STARTS[index]
            if (position !== undefined) addWorldCube(runtime, id, position, faceLabels)
        })
        FLOW_CUBE_IDS.forEach((id, index) => {
            const position = FLOW_STARTS[index]
            if (position !== undefined) addWorldCube(runtime, id, position, faceLabels)
        })
        GROUP_CUBE_IDS.forEach((id, index) => {
            const position = GROUP_STARTS[index]
            if (position !== undefined) addWorldCube(runtime, id, position, faceLabels)
        })
        TRACE_CUBE_IDS.forEach((id) => {
            runtime.addCube({
                id,
                position: ORIGIN,
                opacity: 0,
                hoverCells: 0.04,
                occupiesCell: false,
                faceLabels,
            })
        })

    },
    script: ({ runtime, timeline, presentation }) =>
        runHistorySplit(runtime, timeline.wait, presentation),
})
