import { isSameGridCell } from '../scenes/gridPathfinding'
import { type GridCoordinate } from '../scenes/gridSceneRuntime'
import { defineScene } from '../sdk/defineScene'

const GRID_CELL_SIZE = 0.052
const BREACH_HOLD_DURATION_S = 0.9
const REPAIRED_HOLD_DURATION_S = 1.4
const IMPACT_CUBE_ID = 'boundary-impact-cube'
const IMPACT_PARKING_POSITION: GridCoordinate = { column: 100, row: 101 }

const BOUNDARY_POSITIONS: readonly GridCoordinate[] = [
    { column: -1, row: -1 },
    { column: 0, row: -1 },
    { column: 1, row: -1 },
    { column: 1, row: 0 },
    { column: 1, row: 1 },
    { column: 0, row: 1 },
    { column: -1, row: 1 },
    { column: -1, row: 0 },
]

const BOUNDARY_CUBE_IDS = BOUNDARY_POSITIONS.map(
    (_, index) => `boundary-cube-${index}`
)
const BREACHABLE_INDICES = [1, 3, 5, 7] as const

/** An external cube breaches a protective boundary, which redistributes and repairs itself. */
export const BoundaryRepairScene = defineScene({
    metadata: {
        id: 'boundary-repair',
        title: 'Boundary Repair',
        tags: ['continuity', 'maintenance'],
        description: 'A breached ring redistributes itself back into a boundary.',
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 17,
        gridFadeInnerRadiusCells: 2.5,
        gridFadeOuterRadiusCells: 9,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
    },
    setup: ({ runtime, props }) => {
        for (let index = 0; index < BOUNDARY_POSITIONS.length; index += 1) {
            const id = BOUNDARY_CUBE_IDS[index]
            const position = BOUNDARY_POSITIONS[index]
            if (id !== undefined && position !== undefined) {
                runtime.addCube({ id, position, faceLabels: props.faceLabels })
            }
        }
        runtime.addCube({
            id: IMPACT_CUBE_ID,
            position: IMPACT_PARKING_POSITION,
            opacity: 0,
            faceLabels: props.faceLabels,
        })
    },
    script: async ({ runtime, timeline, random }) => {
        const findCubeAt = (position: GridCoordinate): string | undefined =>
            BOUNDARY_CUBE_IDS.find((cubeId) => {
                const current = runtime.getCubePosition(cubeId)
                return current !== undefined && isSameGridCell(current, position)
            })

        await timeline.wait(REPAIRED_HOLD_DURATION_S)
        await timeline.loop(async () => {
            const breachedIndex = random.item(BREACHABLE_INDICES)
            if (breachedIndex === undefined) return
            const breachedPosition = BOUNDARY_POSITIONS[breachedIndex]
            if (breachedPosition === undefined) return
            const breachedCubeId = findCubeAt(breachedPosition)
            if (breachedCubeId === undefined) return

            const impactStart = {
                column: breachedPosition.column * 4,
                row: breachedPosition.row * 4,
            }
            const impactContact = {
                column: breachedPosition.column * 3,
                row: breachedPosition.row * 3,
            }
            runtime.setCubePosition(IMPACT_CUBE_ID, impactStart)
            runtime.setCubeOpacity(IMPACT_CUBE_ID, 0)
            await Promise.all([
                runtime.moveCubeTo(IMPACT_CUBE_ID, impactContact, {
                    duration: 0.58,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(IMPACT_CUBE_ID, 1, {
                    duration: 0.42,
                    easing: 'easeOutCubic',
                }),
            ])

            await runtime.moveCubeTo(
                breachedCubeId,
                {
                    column: breachedPosition.column * 2,
                    row: breachedPosition.row * 2,
                },
                { duration: 0.38, easing: 'easeOutCubic' }
            )
            await timeline.wait(BREACH_HOLD_DURATION_S * 0.55)
            await Promise.all([
                runtime.moveCubeTo(IMPACT_CUBE_ID, impactStart, {
                    duration: 0.48,
                    easing: 'easeInOutCubic',
                }),
                runtime.fadeCubeTo(IMPACT_CUBE_ID, 0, {
                    duration: 0.48,
                    easing: 'easeOutCubic',
                }),
            ])
            runtime.setCubePosition(IMPACT_CUBE_ID, IMPACT_PARKING_POSITION)

            let vacantPosition = breachedPosition
            const repairShiftCount = 2 + Math.floor(random.next() * 3)
            for (let offset = 1; offset <= repairShiftCount; offset += 1) {
                const movingIndex =
                    (breachedIndex - offset + BOUNDARY_CUBE_IDS.length) %
                    BOUNDARY_CUBE_IDS.length
                const source = BOUNDARY_POSITIONS[movingIndex]
                if (source === undefined) continue
                const movingCubeId = findCubeAt(source)
                if (movingCubeId === undefined) continue
                await runtime.moveCubeTo(movingCubeId, vacantPosition, {
                    duration: 0.34,
                    easing: 'easeInOutCubic',
                })
                vacantPosition = source
                await timeline.wait(0.08)
            }

            await runtime.moveCubeTo(breachedCubeId, vacantPosition, {
                duration: 0.72,
                easing: 'easeInOutCubic',
            })
            await timeline.wait(REPAIRED_HOLD_DURATION_S)
        })
    },
})
