import { MAIN_CUBE_ID, type GridCoordinate } from '@scenes/gridSceneRuntime'
import { defineScene } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.043
const ORIGIN: GridCoordinate = { column: 0, row: 0 }
const ENERGY_FULL_OPACITY = 0.68
const ENERGY_IDS = Array.from({ length: 5 }, (_, index) => `return-energy-${index}`)
const ENERGY_COLUMN_OFFSETS = [2, 3, 4, 5, 6] as const
const FAILURE_ECHO_ID = 'return-failure-echo'
const DOCK_POSITIONS: readonly GridCoordinate[] = [
    { column: -1, row: 0 },
    { column: 1, row: 0 },
    { column: -1, row: 1 },
    { column: 0, row: 1 },
    { column: 1, row: 1 },
]
const TERRAIN_POSITIONS: readonly GridCoordinate[] = [
    { column: 2, row: -5 },
    { column: 2, row: -6 },
    { column: -3, row: -6 },
    { column: -3, row: -8 },
    { column: 1, row: -9 },
]
const OUTBOUND_ROUTE: readonly GridCoordinate[] = [
    { column: 0, row: -2 },
    { column: 1, row: -4 },
    { column: 3, row: -6 },
    { column: 4, row: -8 },
    { column: 4, row: -10 },
]
const LATE_RETURN_ROUTE: readonly GridCoordinate[] = [
    { column: 3, row: -8 },
    { column: 1, row: -6 },
    { column: 0, row: -4 },
    { column: 0, row: -2 },
]
const EARLY_RETURN_ROUTE: readonly GridCoordinate[] = [
    { column: 1, row: -4 },
    { column: 0, row: -2 },
    ORIGIN,
]

const BASE_PRESENTATION = {
    zoom: 1.04,
    gridOpacity: 0.52,
    gridFadeInnerRadiusCells: 3,
    gridFadeOuterRadiusCells: 11,
} as const

const getEnergyPosition = (bodyPosition: GridCoordinate, index: number): GridCoordinate => ({
    column: bodyPosition.column + (ENERGY_COLUMN_OFFSETS[index] ?? 0),
    row: bodyPosition.row,
})

/** A body learns to turn back before its remaining energy can no longer reach home. */
export const AnticipatoryReturnScene = defineScene({
    metadata: {
        id: 'anticipatory-return',
        title: 'Anticipatory Return',
        tags: ['embodiment', 'energy', 'maintenance'],
        description: 'Turning back early, before the energy to return runs out.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 25,
        gridOpacity: BASE_PRESENTATION.gridOpacity,
        gridFadeInnerRadiusCells: BASE_PRESENTATION.gridFadeInnerRadiusCells,
        gridFadeOuterRadiusCells: BASE_PRESENTATION.gridFadeOuterRadiusCells,
        cameraAzimuthDeg: 40,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    presentation: BASE_PRESENTATION,
    setup: ({ runtime, props }) => {
        const { faceLabels } = props
        runtime.setCubePosition(MAIN_CUBE_ID, ORIGIN)
        DOCK_POSITIONS.forEach((position, index) => {
            runtime.addCube({ id: `return-dock-${index}`, position, faceLabels })
        })
        TERRAIN_POSITIONS.forEach((position, index) => {
            runtime.addCube({ id: `return-terrain-${index}`, position, faceLabels })
        })
        ENERGY_IDS.forEach((id, index) => {
            runtime.addCube({
                id,
                position: getEnergyPosition(ORIGIN, index),
                opacity: ENERGY_FULL_OPACITY,
                hoverCells: 0,
                occupiesCell: false,
                faceLabels,
            })
        })
        runtime.addCube({
            id: FAILURE_ECHO_ID,
            position: { column: 0, row: -2 },
            opacity: 0,
            hoverCells: 0.04,
            occupiesCell: false,
            faceLabels,
        })
    },
    script: async ({ runtime, timeline, presentation }) => {
        const setEnergyPositions = (bodyPosition: GridCoordinate): void => {
            ENERGY_IDS.forEach((id, index) => {
                runtime.setCubePosition(id, getEnergyPosition(bodyPosition, index))
            })
        }

        const travelBody = async (position: GridCoordinate, duration = 0.72): Promise<void> => {
            await Promise.all([
                runtime.travelWithCube(MAIN_CUBE_ID, position, {
                    duration,
                    easing: 'easeInOutCubic',
                }),
                ...ENERGY_IDS.map((id, index) =>
                    runtime.moveCubeTo(id, getEnergyPosition(position, index), {
                        duration,
                        easing: 'easeInOutCubic',
                    })
                ),
            ])
        }

        const spendEnergy = (index: number): Promise<void> => {
            const id = ENERGY_IDS[ENERGY_IDS.length - 1 - index]
            return id === undefined
                ? Promise.resolve()
                : runtime.fadeCubeTo(id, 0, {
                      duration: 0.42,
                      easing: 'linear',
                  })
        }

        const recharge = async (): Promise<void> => {
            for (const id of ENERGY_IDS) {
                await runtime.fadeCubeTo(id, ENERGY_FULL_OPACITY, {
                    duration: 0.24,
                    easing: 'easeOutCubic',
                })
                await timeline.wait(0.08)
            }
        }

        const prepareAtDock = async (): Promise<void> => {
            await Promise.all([
                runtime.fadeCubeTo(MAIN_CUBE_ID, 0, { duration: 0.36, easing: 'linear' }),
                ...ENERGY_IDS.map((id) =>
                    runtime.fadeCubeTo(id, 0, { duration: 0.36, easing: 'linear' })
                ),
            ])
            runtime.setCubePosition(MAIN_CUBE_ID, ORIGIN)
            setEnergyPositions(ORIGIN)
            await runtime.moveGridFocusTo(ORIGIN, {
                duration: 0.82,
                easing: 'easeInOutCubic',
            })
            presentation?.setTarget({ zoom: 1.04, gridOpacity: 0.52 })
            await runtime.fadeCubeTo(MAIN_CUBE_ID, 1, {
                duration: 0.38,
                easing: 'easeOutCubic',
            })
            await recharge()
            await timeline.wait(0.55)
        }

        const runLateReturn = async (): Promise<void> => {
            for (let index = 0; index < OUTBOUND_ROUTE.length; index += 1) {
                const position = OUTBOUND_ROUTE[index]
                if (position === undefined) continue
                await travelBody(position)
                await spendEnergy(index)
                await timeline.wait(0.16)
            }
            presentation?.setTarget({ zoom: 1.18, gridOpacity: 0.68 })
            await timeline.wait(0.65)

            for (const position of LATE_RETURN_ROUTE) {
                await travelBody(position, 0.64)
            }
            await runtime.fadeCubeTo(MAIN_CUBE_ID, 0.42, {
                duration: 0.45,
                easing: 'linear',
            })
            await runtime.fadeCubeTo(FAILURE_ECHO_ID, 0.2, {
                duration: 0.42,
                easing: 'easeOutCubic',
            })
            await timeline.wait(1.2)
        }

        const runEarlyReturn = async (): Promise<void> => {
            const earlyOutbound = OUTBOUND_ROUTE.slice(0, 3)
            for (let index = 0; index < earlyOutbound.length; index += 1) {
                const position = earlyOutbound[index]
                if (position === undefined) continue
                await travelBody(position)
                await spendEnergy(index)
                await timeline.wait(0.16)
            }
            presentation?.setTarget({ zoom: 1.2, gridOpacity: 0.7 })
            await timeline.wait(0.72)

            for (const position of EARLY_RETURN_ROUTE) {
                await travelBody(position, 0.66)
            }
            await runtime.fadeCubeTo(FAILURE_ECHO_ID, 0, {
                duration: 0.46,
                easing: 'linear',
            })
            presentation?.setTarget({ zoom: 1.04, gridOpacity: 0.52 })
            await recharge()
            await timeline.wait(1.4)
        }

        await timeline.wait(0.9)
        await timeline.loop(async () => {
            await runLateReturn()
            await prepareAtDock()
            await runEarlyReturn()
            await prepareAtDock()
        })
    },
})
