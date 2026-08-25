import type { JSX } from 'react'

import type { CubeFaceLabelsProps } from '@runtime/grid/cubeFaceLabels'
import { FaceFlipCubeScene } from '@runtime/presentation/FaceFlipCubeScene'
import { attachSceneMetadata } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.13
const GRID_CELL_COUNT = 11

/** A cube that flips between faces and grows smoothly on hover. */
const FlippingCubeSceneComponent = ({
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

export const FlippingCubeScene = attachSceneMetadata(FlippingCubeSceneComponent, {
    primaryCategory: 'interaction',
    id: 'changing-faces',
    title: 'Changing Faces',
    tags: ['form', 'transformation'],
    description: 'A cube that turns to show a different face.',
})
