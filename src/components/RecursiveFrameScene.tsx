import { MAIN_CUBE_ID, type GridCoordinate } from '@scenes/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

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
    FRAME_DIRECTIONS.map((_, directionIndex) => `recursive-frame-${frameIndex}-${directionIndex}`)
)

const BASE_PRESENTATION = {
    zoom: 0.96,
    gridOpacity: 0.5,
    gridFadeInnerRadiusCells: 3,
    gridFadeOuterRadiusCells: 10,
} as const

type RecursiveFrameState = {
    frames: string[][]
}

const getFramePosition = (direction: GridCoordinate, radius: number): GridCoordinate => ({
    column: direction.column * radius,
    row: direction.row * radius,
})

/** Nested frames renew indefinitely while the main cube preserves one continuous path. */
export const RecursiveFrameScene = defineScene<CubeSceneProps, RecursiveFrameState>({
    metadata: {
        id: 'recursive-frame',
        title: 'Recursive Frame',
        tags: ['ontology', 'continuity', 'reality'],
        description: 'Frames renew around a process that never breaks its path.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 19,
        gridOpacity: BASE_PRESENTATION.gridOpacity,
        gridFadeInnerRadiusCells: BASE_PRESENTATION.gridFadeInnerRadiusCells,
        gridFadeOuterRadiusCells: BASE_PRESENTATION.gridFadeOuterRadiusCells,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    presentation: BASE_PRESENTATION,
    setup: ({ runtime, props }) => {
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
                    faceLabels: props.faceLabels,
                })
            })
        })

        return { frames: FRAME_IDS.map((ids) => [...ids]) }
    },
    script: async ({ runtime, timeline, state, presentation }) => {
        const moveProcess = async (): Promise<never> => {
            let routeIndex = 1
            return timeline.loop(async () => {
                const destination = PROCESS_ROUTE[routeIndex]
                if (destination === undefined) return
                await runtime.moveCubeTo(MAIN_CUBE_ID, destination, {
                    duration: 0.28,
                    easing: 'linear',
                })
                routeIndex = (routeIndex + 1) % PROCESS_ROUTE.length
            })
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
            const innerFrame = state.frames[0]
            const middleFrame = state.frames[1]
            const outerFrame = state.frames[2]
            if (innerFrame === undefined || middleFrame === undefined || outerFrame === undefined) {
                return
            }

            presentation?.setTarget({
                zoom: 1.16,
                gridOpacity: 0.38,
                gridFadeInnerRadiusCells: 2,
            })
            await Promise.all([
                moveFrame(outerFrame, EXIT_RADIUS, 0),
                moveFrame(middleFrame, OUTER_RADIUS, FRAME_OPACITIES[2]),
                moveFrame(innerFrame, MIDDLE_RADIUS, FRAME_OPACITIES[1]),
            ])

            outerFrame.forEach((id, index) => {
                const direction = FRAME_DIRECTIONS[index]
                if (direction === undefined) return
                runtime.setCubePosition(id, getFramePosition(direction, INNER_RADIUS))
            })

            presentation?.setTarget({
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
            state.frames = [outerFrame, innerFrame, middleFrame]
        }

        const cycleFrames = async (): Promise<never> => {
            await timeline.wait(1.4)
            return timeline.loop(async () => {
                await shiftFrames()
                await timeline.wait(2.2)
            })
        }

        // The process and the frames are independent clocks; cancellation reaches both.
        await Promise.all([moveProcess(), cycleFrames()])
    },
    teardown: (_context, state) => {
        state.frames = []
    },
})
