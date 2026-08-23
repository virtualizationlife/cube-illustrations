import type { JSX } from 'react'

import { GridPathCubeScene } from '../scenes/GridPathCubeScene'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'

const GRID_CELL_SIZE = 0.1

/** One static cube centered on the grid, viewed at a 45-degree azimuth. */
export const CenteredCubeScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => (
    <GridPathCubeScene
        cubeSize={GRID_CELL_SIZE}
        cubeCornerRadius={cubeCornerRadius}
        gridCellSize={GRID_CELL_SIZE}
        gridCellCount={5}
        cameraAzimuthDeg={45}
        viewOffsetY={0}
        hoverCells={0}
        movementMode='move-cube'
        mainCubeFaceLabels={faceLabels}
    />
)
