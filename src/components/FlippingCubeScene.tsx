import type { JSX } from 'react'

import { FaceFlipCubeScene } from '../scenes/FaceFlipCubeScene'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'

const GRID_CELL_SIZE = 0.13
const GRID_CELL_COUNT = 3

/** A cube that flips between faces and grows smoothly on hover. */
export const FlippingCubeScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => (
    <FaceFlipCubeScene
        cubeSize={GRID_CELL_SIZE}
        cubeCornerRadius={cubeCornerRadius}
        gridCellSize={GRID_CELL_SIZE}
        gridCellCount={GRID_CELL_COUNT}
        cameraAzimuthDeg={45}
        viewOffsetY={-GRID_CELL_SIZE}
        hoverCells={1}
        mainCubeFaceLabels={faceLabels}
    />
)
