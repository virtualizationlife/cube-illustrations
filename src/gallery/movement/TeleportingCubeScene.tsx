import { MAIN_CUBE_ID, type GridCoordinate } from '@runtime/grid/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.1
const TELEPORT_RADIUS_CELLS = 5
const DEFAULT_TRANSPARENCY_DURATION_S = 3
const CAMERA_TRAVEL_DURATION_S = 0.8
const CYCLE_PAUSE_S = 0.5

export type TeleportingCubeSceneProps = {
    /** Seconds for one cube to dissolve while its successor becomes opaque. */
    readonly transparencyDuration?: number
} & CubeSceneProps

type TeleportState = {
    activeCubeId: string
    activePosition: GridCoordinate
    cycle: number
}

const getTeleportDestination = (
    position: GridCoordinate,
    randomValue: () => number
): GridCoordinate => {
    for (;;) {
        const columnOffset =
            Math.floor(randomValue() * (TELEPORT_RADIUS_CELLS * 2 + 1)) - TELEPORT_RADIUS_CELLS
        const rowOffset =
            Math.floor(randomValue() * (TELEPORT_RADIUS_CELLS * 2 + 1)) - TELEPORT_RADIUS_CELLS
        if (
            (columnOffset !== 0 || rowOffset !== 0) &&
            Math.hypot(columnOffset, rowOffset) <= TELEPORT_RADIUS_CELLS
        ) {
            return {
                column: position.column + columnOffset,
                row: position.row + rowOffset,
            }
        }
    }
}

/** A successor appears within five cells as the current focused cube dissolves away. */
export const TeleportingCubeScene = defineScene<TeleportingCubeSceneProps, TeleportState>({
    metadata: {
        primaryCategory: 'movement',
        id: 'teleporting-cube',
        title: 'Dissolving Transfer',
        tags: ['movement', 'transparency', 'transition'],
        description: 'One cube dissolves while a new cube appears nearby and receives the focus.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 15,
        gridFadeInnerRadiusCells: 1.5,
        gridFadeOuterRadiusCells: 8,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: () => ({
        activeCubeId: MAIN_CUBE_ID,
        activePosition: { column: 0, row: 0 },
        cycle: 0,
    }),
    restartKey: ({ transparencyDuration }) => transparencyDuration,
    script: async ({ runtime, timeline, state, props, random }) => {
        const transparencyDuration = Math.max(
            0,
            props.transparencyDuration ?? DEFAULT_TRANSPARENCY_DURATION_S
        )
        await timeline.wait(0.8)

        await timeline.loop(async () => {
            const destination = getTeleportDestination(state.activePosition, random.next)
            const incomingCubeId = `teleport-successor-${state.cycle}`
            state.cycle += 1
            runtime.addCube({
                id: incomingCubeId,
                position: destination,
                opacity: 0,
                faceLabels: props.faceLabels,
            })

            await Promise.all([
                runtime.fadeCubeTo(state.activeCubeId, 0, {
                    duration: transparencyDuration,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(incomingCubeId, 1, {
                    duration: transparencyDuration,
                    easing: 'easeInOutCubic',
                }),
            ])

            await runtime.moveGridFocusTo(destination, {
                duration: CAMERA_TRAVEL_DURATION_S,
                easing: 'easeInOutCubic',
            })
            runtime.removeCube(state.activeCubeId)
            state.activeCubeId = incomingCubeId
            state.activePosition = destination
            await timeline.wait(CYCLE_PAUSE_S)
        })
    },
})
