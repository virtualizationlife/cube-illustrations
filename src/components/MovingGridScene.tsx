import type { JSX } from 'react'

import { GridPathCubeScene } from '../scenes/GridPathCubeScene'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import type { GridRandomWalkConfig } from '../scenes/gridSceneAnimation'

const GRID_CELL_SIZE = 0.085

const RANDOM_WALK: GridRandomWalkConfig = {
    stepLengths: [1, 1, 1, 2],
    encounterChance: 0.08,
    maxEncounterCubes: 1,
    encounterSpawnDistance: 5,
    cleanupDistance: 5,
    fullyVisibleDistance: 2,
    visibilityDistance: 4.5,
    opacitySmoothingDuration: 0.15,
    encounterDistance: 1,
    encounterPauseDuration: 1,
    companionChance: 0.4,
    companionStepCounts: [2, 3, 4],
}

/** A fixed central cube explores a moving world; an occasional encounter follows briefly. */
export const MovingGridScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => (
    <GridPathCubeScene
        cubeSize={GRID_CELL_SIZE}
        cubeCornerRadius={cubeCornerRadius}
        gridCellSize={GRID_CELL_SIZE}
        gridCellCount={9}
        gridOpacity={1}
        gridFadeInnerRadiusCells={1.5}
        gridFadeOuterRadiusCells={5}
        cameraAzimuthDeg={60}
        cameraElevationDeg={25}
        viewOffsetY={0}
        hoverCells={0}
        movementMode='move-grid'
        randomWalk={RANDOM_WALK}
        mainCubeFaceLabels={faceLabels}
    />
)
