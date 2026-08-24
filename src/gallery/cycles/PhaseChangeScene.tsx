import { MAIN_CUBE_ID, type GridCoordinate } from '@runtime/grid/gridSceneRuntime'
import { defineScene, type CubeSceneProps } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.035
const PHASE_CUBE_IDS = [
    MAIN_CUBE_ID,
    ...Array.from({ length: 11 }, (_, index) => `phase-change-${index}`),
] as const
const SCATTER_POSITIONS: readonly GridCoordinate[] = [
    { column: -7, row: -5 },
    { column: -4, row: -7 },
    { column: 0, row: -6 },
    { column: 4, row: -7 },
    { column: 7, row: -4 },
    { column: 6, row: 1 },
    { column: 7, row: 5 },
    { column: 3, row: 7 },
    { column: -1, row: 6 },
    { column: -5, row: 7 },
    { column: -7, row: 3 },
    { column: -6, row: -1 },
]
const CRYSTAL_POSITIONS: readonly GridCoordinate[] = [-1, 0, 1].flatMap((row) =>
    [-2, -1, 0, 1].map((column) => ({ column, row }))
)

type PhaseChangeState = {
    previousSeedIndex: number
}

/** Scattered cubes crystallize around a random seed and then disperse again. */
export const PhaseChangeScene = defineScene<CubeSceneProps, PhaseChangeState>({
    metadata: {
        primaryCategory: 'cycles',
        id: 'phase-change',
        title: 'Phase Change',
        tags: ['adaptation', 'organization'],
        description: 'Scattered cubes lock into a lattice and melt back apart.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 23,
        gridFadeInnerRadiusCells: 4,
        gridFadeOuterRadiusCells: 12,
        cameraAzimuthDeg: 35,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        PHASE_CUBE_IDS.forEach((cubeId, index) => {
            const position = SCATTER_POSITIONS[index]
            if (position === undefined) return
            if (cubeId === MAIN_CUBE_ID) runtime.setCubePosition(cubeId, position)
            else runtime.addCube({ id: cubeId, position, faceLabels: props.faceLabels })
        })
        return { previousSeedIndex: -1 }
    },
    script: async ({ runtime, timeline, random, state }) => {
        const crystallize = async (): Promise<void> => {
            const seedIndex = random.differentIndex(
                CRYSTAL_POSITIONS.length,
                state.previousSeedIndex
            )
            state.previousSeedIndex = seedIndex
            const seed = CRYSTAL_POSITIONS[seedIndex]
            if (seed === undefined) return
            const orderedTargets = [...CRYSTAL_POSITIONS].sort((left, right) => {
                const leftDistance =
                    Math.abs(left.column - seed.column) + Math.abs(left.row - seed.row)
                const rightDistance =
                    Math.abs(right.column - seed.column) + Math.abs(right.row - seed.row)
                return leftDistance - rightDistance
            })
            const movingIds = random.shuffle(PHASE_CUBE_IDS)

            for (let index = 0; index < movingIds.length; index += 1) {
                const cubeId = movingIds[index]
                const target = orderedTargets[index]
                if (cubeId === undefined || target === undefined) continue
                await runtime.moveCubeTo(cubeId, target, {
                    duration: 0.34,
                    easing: 'easeInOutCubic',
                })
                if (index === 0) {
                    await runtime.fadeCubeTo(cubeId, 0.3, {
                        duration: 0.14,
                        easing: 'easeOutCubic',
                    })
                    await runtime.fadeCubeTo(cubeId, 1, {
                        duration: 0.18,
                        easing: 'easeOutCubic',
                    })
                }
                await timeline.wait(0.035)
            }
        }

        const melt = async (): Promise<void> => {
            for (const cubeId of random.shuffle(PHASE_CUBE_IDS)) {
                const scatterIndex = PHASE_CUBE_IDS.indexOf(cubeId)
                const target = SCATTER_POSITIONS[scatterIndex]
                if (target === undefined) continue
                await runtime.moveCubeTo(cubeId, target, {
                    duration: 0.3,
                    easing: 'easeInOutCubic',
                })
                await timeline.wait(0.025)
            }
        }

        await timeline.wait(0.8)
        await timeline.loop(async () => {
            await crystallize()
            await timeline.wait(1.15)
            await melt()
            await timeline.wait(1)
        })
    },
})
