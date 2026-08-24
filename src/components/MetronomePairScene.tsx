import { MAIN_CUBE_ID } from '../scenes/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '../sdk/defineScene'

const GRID_CELL_SIZE = 0.06
const PARTNER_CUBE_ID = 'metronome-partner'
const SWING_ROW = 0
const LEFT_COLUMNS = [-3, -2] as const
const RIGHT_COLUMNS = [2, 3] as const
const INITIAL_PERIODS_S = [0.46, 0.74] as const
const SWING_DURATION_RATIO = 0.68
/** Share of the period difference that one swing removes from the other pendulum. */
const PERIOD_COUPLING = 0.16
/** Share of the phase difference that one swing removes from the other pendulum. */
const PHASE_COUPLING = 0.24
const SYNC_TOLERANCE_S = 0.03
const SYNCED_SWINGS_BEFORE_RESET = 8
const INITIAL_PHASE_OFFSET_RATIO = 0.55

interface Pendulum {
    readonly id: string
    readonly columns: readonly [number, number]
    period: number
    timeToSwing: number
    columnIndex: number
}

interface MetronomePairState {
    readonly pendulums: readonly [Pendulum, Pendulum]
    syncedSwings: number
}

const createPendulum = (
    id: string,
    columns: readonly [number, number],
    period: number
): Pendulum => ({ id, columns, period, timeToSwing: period, columnIndex: 0 })

/** Two pendulums with different periods pull each other into a shared rhythm. */
export const MetronomePairScene = defineScene<CubeSceneProps, MetronomePairState>({
    metadata: {
        id: 'two-metronomes',
        title: 'Two Metronomes',
        tags: ['rhythm', 'synchrony'],
        description: 'Two detuned pendulums pull each other into one rhythm.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 15,
        gridFadeInnerRadiusCells: 2.5,
        gridFadeOuterRadiusCells: 8,
        cameraAzimuthDeg: 0,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        const [leftColumn] = LEFT_COLUMNS
        const [rightColumn] = RIGHT_COLUMNS
        runtime.setCubePosition(MAIN_CUBE_ID, { column: leftColumn, row: SWING_ROW })
        runtime.addCube({
            id: PARTNER_CUBE_ID,
            position: { column: rightColumn, row: SWING_ROW },
            faceLabels: props.faceLabels,
        })

        const [leftPeriod = 0.5, rightPeriod = 0.75] = INITIAL_PERIODS_S
        return {
            pendulums: [
                createPendulum(MAIN_CUBE_ID, LEFT_COLUMNS, leftPeriod),
                createPendulum(PARTNER_CUBE_ID, RIGHT_COLUMNS, rightPeriod),
            ],
            syncedSwings: 0,
        }
    },
    script: async ({ runtime, timeline, state }) => {
        const [leftPeriod = 0.5, rightPeriod = 0.75] = INITIAL_PERIODS_S
        const { pendulums } = state

        const swing = (pendulum: Pendulum): void => {
            pendulum.columnIndex = pendulum.columnIndex === 0 ? 1 : 0
            const column = pendulum.columns[pendulum.columnIndex]
            if (column === undefined) return
            void runtime.moveCubeTo(
                pendulum.id,
                { column, row: SWING_ROW },
                {
                    duration: pendulum.period * SWING_DURATION_RATIO,
                    easing: 'easeInOutCubic',
                }
            )
        }

        /** A swinging pendulum drags its neighbour's period and phase towards its own. */
        const couple = (source: Pendulum, target: Pendulum): void => {
            target.period += (source.period - target.period) * PERIOD_COUPLING
            target.timeToSwing =
                target.timeToSwing < target.period / 2
                    ? target.timeToSwing * (1 - PHASE_COUPLING)
                    : target.timeToSwing +
                      (target.period - target.timeToSwing) * PHASE_COUPLING
        }

        const restartDetuned = (): void => {
            const [first, second] = pendulums
            first.period = leftPeriod
            second.period = rightPeriod
            first.timeToSwing = first.period
            second.timeToSwing = second.period * INITIAL_PHASE_OFFSET_RATIO
            state.syncedSwings = 0
        }

        await timeline.wait(0.7)
        const [first, second] = pendulums
        second.timeToSwing = second.period * INITIAL_PHASE_OFFSET_RATIO

        await timeline.loop(async () => {
            const step = Math.min(first.timeToSwing, second.timeToSwing)
            await timeline.wait(step)

            first.timeToSwing -= step
            second.timeToSwing -= step
            const firstFired = first.timeToSwing <= SYNC_TOLERANCE_S / 4
            const secondFired = second.timeToSwing <= SYNC_TOLERANCE_S / 4

            for (const pendulum of pendulums) {
                if (pendulum.timeToSwing > SYNC_TOLERANCE_S / 4) continue
                swing(pendulum)
                pendulum.timeToSwing = pendulum.period
            }

            if (firstFired !== secondFired) {
                couple(firstFired ? first : second, firstFired ? second : first)
                state.syncedSwings = 0
                return
            }

            state.syncedSwings =
                Math.abs(first.period - second.period) < SYNC_TOLERANCE_S
                    ? state.syncedSwings + 1
                    : 0
            if (state.syncedSwings >= SYNCED_SWINGS_BEFORE_RESET) restartDetuned()
        })
    },
})
