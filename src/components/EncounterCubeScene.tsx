import { useCallback, type JSX } from 'react'

import { GridPathCubeScene } from '../scenes/GridPathCubeScene'
import type {
    CubeFaceLabelsProps,
    GridCubeFaceLabelInput,
} from '../scenes/cubeFaceLabels'
import type { GridProximityOpacityConfig } from '../scenes/gridSceneAnimation'
import {
    getGridDistance,
    type GridCoordinate,
    type GridSceneCubeDefinition,
} from '../scenes/gridSceneRuntime'
import { attachSceneMetadata } from '../sdk/defineScene'

const GRID_CELL_SIZE = 0.04
const ENCOUNTER_CUBE_IDS = ['encounter-1', 'encounter-2', 'encounter-3'] as const

/**
 * The exploration runs inside a closed territory, so the grid has to end somewhere the
 * viewer can see. Cells reach from -5 to +5 on both axes — the widest square that still
 * fits inside the frame whole, border included — and the odd count keeps the lines on
 * half-integers, which is what puts a whole-numbered coordinate at a cell centre.
 */
const TERRITORY_RADIUS_CELLS = 5
const GRID_CELL_COUNT = TERRITORY_RADIUS_CELLS * 2 + 1

/**
 * Zero radii switch the radial fade off (see `createGridLines`). The default fade dissolves
 * the grid into an open plane well before its edge, which is the opposite of what this
 * scene says: here every cell of the territory stays drawn, and the only thing that ends
 * the grid is its border.
 */
const TERRITORY_FADE_RADIUS_CELLS = 0

/** Minimum Manhattan distance between generated cubes, measured in grid cells. */
export const ENCOUNTER_SCENE_MIN_CUBE_DISTANCE = 2

// Turns one cell short of the border on every side, so the route reads as movement the
// territory contains rather than as a cube sliding along its edge.
const MOVEMENT_ROUTE: readonly GridCoordinate[] = [
    { column: 1, row: -3 },
    { column: 4, row: -3 },
    { column: 4, row: 2 },
    { column: 1, row: 2 },
    { column: 1, row: 1 },
    { column: -2, row: 1 },
    { column: -4, row: 1 },
    { column: -4, row: -3 },
    { column: 0, row: -3 },
]

const createEncounterCubes = (
    faceLabels?: GridCubeFaceLabelInput
): readonly GridSceneCubeDefinition[] => {
    const positions: GridCoordinate[] = []

    return ENCOUNTER_CUBE_IDS.map((id) => {
        let position: GridCoordinate
        do {
            position = {
                column: Math.floor(Math.random() * GRID_CELL_COUNT) - TERRITORY_RADIUS_CELLS,
                row: Math.floor(Math.random() * GRID_CELL_COUNT) - TERRITORY_RADIUS_CELLS,
            }
        } while (
            getGridDistance({ column: 0, row: 0 }, position) <
                ENCOUNTER_SCENE_MIN_CUBE_DISTANCE ||
            positions.some(
                (placedPosition) =>
                    getGridDistance(placedPosition, position) <
                    ENCOUNTER_SCENE_MIN_CUBE_DISTANCE
            )
        )
        positions.push(position)
        return { id, position, opacity: 0.3, faceLabels }
    })
}

const PROXIMITY_OPACITY: GridProximityOpacityConfig = {
    targetCubeIds: ENCOUNTER_CUBE_IDS,
    baseOpacity: 0.3,
    fadeStartDistance: 4,
    farDistance: 3,
    farOpacity: 0.6,
    nearDistance: 1,
    nearOpacity: 1,
    smoothingDuration: 0.3,
}

/** A moving main cube that reveals randomly placed cubes as it approaches them. */
const EncounterCubeSceneComponent = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const additionalCubesFactory = useCallback(
        () => createEncounterCubes(faceLabels),
        [faceLabels]
    )

    return (
        <GridPathCubeScene
            cubeSize={GRID_CELL_SIZE}
            cubeCornerRadius={cubeCornerRadius}
            gridCellSize={GRID_CELL_SIZE}
            gridCellCount={GRID_CELL_COUNT}
            gridFadeInnerRadiusCells={TERRITORY_FADE_RADIUS_CELLS}
            gridFadeOuterRadiusCells={TERRITORY_FADE_RADIUS_CELLS}
            cameraAzimuthDeg={30}
            viewOffsetY={0}
            hoverCells={0}
            movementMode='move-cube'
            route={MOVEMENT_ROUTE}
            mainCubeFaceLabels={faceLabels}
            additionalCubesFactory={additionalCubesFactory}
            proximityOpacity={PROXIMITY_OPACITY}
        />
    )
}

export const EncounterCubeScene = attachSceneMetadata(EncounterCubeSceneComponent, {
    id: 'discovery',
    title: 'Discovery',
    tags: ['space', 'perception'],
    description: 'Cubes are revealed as the traveller comes near them.',
})
