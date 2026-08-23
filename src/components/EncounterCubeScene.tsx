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

const GRID_CELL_SIZE = 0.04
const ENCOUNTER_CUBE_IDS = ['encounter-1', 'encounter-2', 'encounter-3'] as const

/** Minimum Manhattan distance between generated cubes, measured in grid cells. */
export const ENCOUNTER_SCENE_MIN_CUBE_DISTANCE = 2

const MOVEMENT_ROUTE: readonly GridCoordinate[] = [
    { column: 1, row: 0 },
    { column: 3, row: 0 },
    { column: 3, row: 3 },
    { column: 1, row: 3 },
    { column: 1, row: 2 },
    { column: -2, row: 2 },
    { column: -3, row: 2 },
    { column: -3, row: 0 },
    { column: 0, row: 0 },
]

const createEncounterCubes = (
    faceLabels?: GridCubeFaceLabelInput
): readonly GridSceneCubeDefinition[] => {
    const positions: GridCoordinate[] = []

    return ENCOUNTER_CUBE_IDS.map((id) => {
        let position: GridCoordinate
        do {
            position = {
                column: Math.floor(Math.random() * 9) - 4,
                row: Math.floor(Math.random() * 9) - 4,
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
export const EncounterCubeScene = ({ faceLabels }: CubeFaceLabelsProps): JSX.Element => {
    const additionalCubesFactory = useCallback(
        () => createEncounterCubes(faceLabels),
        [faceLabels]
    )

    return (
        <GridPathCubeScene
            cubeSize={GRID_CELL_SIZE}
            gridCellSize={GRID_CELL_SIZE}
            gridCellCount={11}
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
