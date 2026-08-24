import { MAIN_CUBE_ID } from '../scenes/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '../sdk/defineScene'

const GRID_CELL_SIZE = 0.06
const INITIAL_RAIL_COLUMNS = [-2, -1, 0, 1, 2] as const
const UPPER_RAIL_IDS = INITIAL_RAIL_COLUMNS.map((_, index) => `bridge-upper-${index}`)
const LOWER_RAIL_IDS = INITIAL_RAIL_COLUMNS.map((_, index) => `bridge-lower-${index}`)

const BASE_PRESENTATION = {
    zoom: 1.02,
    gridOpacity: 0.52,
    gridFadeInnerRadiusCells: 2.5,
    gridFadeOuterRadiusCells: 9,
} as const

interface MovingBridgeState {
    mainColumn: number
    frontColumn: number
    cycleCount: number
    readonly upperQueue: string[]
    readonly lowerQueue: string[]
}

/** Rear supports overtake a centered traveling cube and continuously rebuild its path ahead. */
export const MovingBridgeScene = defineScene<CubeSceneProps, MovingBridgeState>({
    metadata: {
        id: 'moving-bridge',
        title: 'Moving Bridge',
        tags: ['continuation', 'resources'],
        description: 'The path ahead is rebuilt from the supports left behind.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 17,
        gridOpacity: BASE_PRESENTATION.gridOpacity,
        gridFadeInnerRadiusCells: BASE_PRESENTATION.gridFadeInnerRadiusCells,
        gridFadeOuterRadiusCells: BASE_PRESENTATION.gridFadeOuterRadiusCells,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    presentation: BASE_PRESENTATION,
    setup: ({ runtime, props }) => {
        INITIAL_RAIL_COLUMNS.forEach((column, index) => {
            const upperId = UPPER_RAIL_IDS[index]
            const lowerId = LOWER_RAIL_IDS[index]
            if (upperId !== undefined) {
                runtime.addCube({
                    id: upperId,
                    position: { column, row: -1 },
                    faceLabels: props.faceLabels,
                })
            }
            if (lowerId !== undefined) {
                runtime.addCube({
                    id: lowerId,
                    position: { column, row: 1 },
                    faceLabels: props.faceLabels,
                })
            }
        })
        return {
            mainColumn: 0,
            frontColumn: 2,
            cycleCount: 0,
            upperQueue: [...UPPER_RAIL_IDS],
            lowerQueue: [...LOWER_RAIL_IDS],
        }
    },
    script: async ({ runtime, timeline, state, presentation }) => {
        const moveRearSupportsToFront = async (): Promise<void> => {
            const upperId = state.upperQueue.shift()
            const lowerId = state.lowerQueue.shift()
            if (upperId === undefined || lowerId === undefined) return
            state.frontColumn += 1
            await Promise.all([
                runtime.moveCubeTo(
                    upperId,
                    { column: state.frontColumn, row: -1 },
                    { duration: 0.82, easing: 'easeInOutCubic' }
                ),
                runtime.moveCubeTo(
                    lowerId,
                    { column: state.frontColumn, row: 1 },
                    { duration: 0.82, easing: 'easeInOutCubic' }
                ),
            ])
            state.upperQueue.push(upperId)
            state.lowerQueue.push(lowerId)
        }

        await timeline.wait(0.8)
        await timeline.loop(async () => {
            presentation?.setTarget({
                zoom: 0.94,
                gridOpacity: 0.46,
                gridFadeInnerRadiusCells: 3,
                gridFadeOuterRadiusCells: 9,
            })
            state.mainColumn += 1
            await runtime.travelWithCube(
                MAIN_CUBE_ID,
                { column: state.mainColumn, row: 0 },
                { duration: 0.62, easing: 'easeInOutCubic' }
            )

            state.cycleCount += 1
            const supportIsDelayed = state.cycleCount % 4 === 0
            if (supportIsDelayed) {
                presentation?.setTarget({
                    zoom: 1.18,
                    gridOpacity: 0.7,
                    gridFadeInnerRadiusCells: 1.5,
                    gridFadeOuterRadiusCells: 9,
                })
                await timeline.wait(1.05)
            }

            await moveRearSupportsToFront()
            presentation?.setTarget({ zoom: 1.02, gridOpacity: 0.52 })
            await timeline.wait(supportIsDelayed ? 0.35 : 0.16)
        })
    },
})
