import type { JSX } from 'react'

import { GridPathCubeScene } from '../scenes/GridPathCubeScene'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import type { GridSceneCubeDefinition } from '../scenes/gridSceneRuntime'

const GRID_CELL_SIZE = 0.1

/** Three static cubes in a row with one empty grid cell between adjacent cubes. */
export const ThreeCubesScene = ({ faceLabels }: CubeFaceLabelsProps): JSX.Element => {
    const additionalCubes: readonly GridSceneCubeDefinition[] = [
        { id: 'left-cube', position: { column: -2, row: 0 }, faceLabels },
        { id: 'right-cube', position: { column: 2, row: 0 }, faceLabels },
    ]

    return (
        <GridPathCubeScene
            cubeSize={GRID_CELL_SIZE}
            gridCellSize={GRID_CELL_SIZE}
            gridCellCount={5}
            cameraAzimuthDeg={0}
            viewOffsetY={0}
            hoverCells={0}
            movementMode='move-cube'
            mainCubeFaceLabels={faceLabels}
            additionalCubes={additionalCubes}
        />
    )
}
