import { MAIN_CUBE_ID } from '@scenes/gridSceneRuntime'
import { GRID_PRESETS } from '@scenes/motion'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = GRID_PRESETS.corridor.gridCellSize
/** Every carrier that can ever be under the load; only a phase's crew exists at a time. */
const CARRIER_IDS = Array.from({ length: 5 }, (_, index) => `shared-carrier-${index}`)
const INITIAL_CREW_SIZE = 3

type CarrierPace = {
    /** Carriers that leave the line together, which is also the load's step per cycle. */
    readonly relocations: number
    readonly stepAside: number
    readonly walkAhead: number
    readonly stepIn: number
    readonly pause: number
    readonly zoom: number
}

const STEADY_PACE: CarrierPace = {
    relocations: 1,
    stepAside: 0.26,
    walkAhead: 0.74,
    stepIn: 0.26,
    pause: 0.32,
    zoom: 1.06,
}
const BRISK_PACE: CarrierPace = {
    relocations: 1,
    stepAside: 0.19,
    walkAhead: 0.48,
    stepIn: 0.19,
    pause: 0.14,
    zoom: 0.99,
}
const RUSHING_PACE: CarrierPace = {
    relocations: 2,
    stepAside: 0.16,
    walkAhead: 0.44,
    stepIn: 0.16,
    pause: 0.06,
    zoom: 0.9,
}

const getPace = (crewSize: number): CarrierPace => {
    if (crewSize >= 5) return RUSHING_PACE
    if (crewSize === 4) return BRISK_PACE
    return STEADY_PACE
}

type CrewPhase = {
    readonly crewSize: number
    readonly cycles: number
}

/** The crew grows to five and shrinks back to three, then the sequence repeats. */
const CREW_PHASES: readonly CrewPhase[] = [
    { crewSize: 3, cycles: 3 },
    { crewSize: 4, cycles: 3 },
    { crewSize: 5, cycles: 4 },
    { crewSize: 4, cycles: 3 },
]

const BASE_PRESENTATION = {
    zoom: STEADY_PACE.zoom,
    gridOpacity: 0.55,
    gridFadeInnerRadiusCells: 3,
    gridFadeOuterRadiusCells: 9,
} as const

type SharedLoadState = {
    /** Carriers on consecutive columns of row 0, ordered from the rear to the front. */
    readonly crew: string[]
    frontColumn: number
    sideSign: number
}

/** Carriers take turns under a lifted load, stepping around it to rebuild the line ahead. */
export const SharedLoadScene = defineScene<CubeSceneProps, SharedLoadState>({
    metadata: {
        id: 'shared-load',
        title: 'Shared Load',
        tags: ['cooperation', 'resources'],
        description: 'Carriers take turns under one load and rebuild the line ahead.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: GRID_PRESETS.corridor.gridCellCount,
        gridOpacity: BASE_PRESENTATION.gridOpacity,
        gridFadeInnerRadiusCells: BASE_PRESENTATION.gridFadeInnerRadiusCells,
        gridFadeOuterRadiusCells: BASE_PRESENTATION.gridFadeOuterRadiusCells,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 1,
    },
    presentation: BASE_PRESENTATION,
    setup: ({ runtime }) => {
        // The load rides one cell above the grid, on the same cells as its carriers.
        runtime.setCubeOccupiesCell(MAIN_CUBE_ID, false)
        // The load starts at column 0, so the first crew is built directly under it.
        return { crew: [], frontColumn: STEADY_PACE.relocations, sideSign: 1 }
    },
    script: async ({ runtime, timeline, props, state, presentation }) => {
        const { crew } = state

        /** Alternates the lane a carrier uses so passing carriers never share one side. */
        const nextSide = (): number => {
            state.sideSign = -state.sideSign
            return state.sideSign
        }

        /**
         * Only the rearmost carriers step out of the line, so the load rides over the part
         * of it that never empties: as many cells behind the leader as there are carriers
         * relocating in one cycle.
         */
        const getLoadColumn = (pace: CarrierPace): number => state.frontColumn - pace.relocations

        /** Deliberately not awaited: the load travels while the crew keeps moving. */
        const carryLoadTo = (column: number, duration: number): void => {
            void runtime
                .travelWithCube(
                    MAIN_CUBE_ID,
                    { column, row: 0 },
                    { duration, easing: 'easeInOutCubic' }
                )
                .catch(() => undefined)
        }

        /** Walks one carrier out of the line, past the crew, and back in at the front. */
        const relocate = async (
            carrierId: string,
            targetColumn: number,
            side: number,
            pace: CarrierPace
        ): Promise<void> => {
            const start = runtime.getCubePosition(carrierId)
            if (start === undefined) return
            await runtime.moveCubeTo(
                carrierId,
                { column: start.column, row: side },
                { duration: pace.stepAside, easing: 'easeOutCubic' }
            )
            await runtime.moveCubeTo(
                carrierId,
                { column: targetColumn, row: side },
                { duration: pace.walkAhead, easing: 'easeInOutCubic' }
            )
            await runtime.moveCubeTo(
                carrierId,
                { column: targetColumn, row: 0 },
                { duration: pace.stepIn, easing: 'easeOutCubic' }
            )
        }

        const runCarryCycle = async (pace: CarrierPace): Promise<void> => {
            const leaving = crew.splice(0, pace.relocations)
            if (leaving.length === 0) return
            const relocations = leaving.map((carrierId, index) =>
                relocate(carrierId, state.frontColumn + index + 1, nextSide(), pace)
            )
            state.frontColumn += leaving.length
            crew.push(...leaving)

            await timeline.wait(pace.stepAside)
            carryLoadTo(getLoadColumn(pace), pace.walkAhead + pace.stepIn)
            await Promise.all(relocations)
            await timeline.wait(pace.pause)
        }

        /** A spare carrier walks in behind the crew and takes the last place in the line. */
        const addCarrier = async (): Promise<void> => {
            const carrierId = CARRIER_IDS.find((id) => !runtime.hasCube(id))
            if (carrierId === undefined) return
            const rearColumn = state.frontColumn - crew.length
            const side = nextSide()
            runtime.addCube({
                id: carrierId,
                position: { column: rearColumn - 1, row: side },
                opacity: 0,
                faceLabels: props.faceLabels,
            })
            await Promise.all([
                runtime.fadeCubeTo(carrierId, 1, { duration: 0.4, easing: 'linear' }),
                runtime.moveCubeTo(
                    carrierId,
                    { column: rearColumn, row: side },
                    { duration: 0.44, easing: 'easeOutCubic' }
                ),
            ])
            await runtime.moveCubeTo(
                carrierId,
                { column: rearColumn, row: 0 },
                { duration: 0.3, easing: 'easeOutCubic' }
            )
            crew.unshift(carrierId)
        }

        /** The rearmost carrier steps out of the line and stays behind. */
        const removeCarrier = async (): Promise<void> => {
            const carrierId = crew.shift()
            if (carrierId === undefined) return
            const position = runtime.getCubePosition(carrierId)
            if (position !== undefined) {
                await runtime.moveCubeTo(
                    carrierId,
                    { column: position.column, row: nextSide() },
                    { duration: 0.32, easing: 'easeOutCubic' }
                )
            }
            await runtime.fadeCubeTo(carrierId, 0, { duration: 0.42, easing: 'linear' })
            runtime.removeCube(carrierId)
        }

        const setCrewSize = async (crewSize: number): Promise<void> => {
            while (crew.length < crewSize) await addCarrier()
            while (crew.length > crewSize) await removeCarrier()
        }

        /**
         * A shorter line carries the load closer to its leader. The load slides into its new
         * place while the crew reshapes; a longer line lets the next cycle catch up instead,
         * because the load never travels backwards.
         */
        const settleLoad = async (pace: CarrierPace): Promise<void> => {
            const target = getLoadColumn(pace)
            const current = runtime.getCubePosition(MAIN_CUBE_ID)?.column
            if (current === undefined || target <= current) return
            await runtime.travelWithCube(
                MAIN_CUBE_ID,
                { column: target, row: 0 },
                { duration: 0.52, easing: 'easeInOutCubic' }
            )
        }

        await setCrewSize(INITIAL_CREW_SIZE)
        await timeline.wait(0.8)
        let phaseIndex = 0
        await timeline.loop(async () => {
            const phase = CREW_PHASES[phaseIndex]
            if (phase === undefined) return
            phaseIndex = (phaseIndex + 1) % CREW_PHASES.length

            const pace = getPace(phase.crewSize)
            presentation?.setTarget({ zoom: pace.zoom })
            await setCrewSize(phase.crewSize)
            await settleLoad(pace)
            for (let cycle = 0; cycle < phase.cycles; cycle += 1) {
                await runCarryCycle(pace)
            }
        })
    },
})
