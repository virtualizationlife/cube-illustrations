import { defineScene } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.05

/** A deliberately empty panoramic world, ready to receive its first actors. */
export const WorldGridScene = defineScene({
    metadata: {
        primaryCategory: 'world',
        id: 'world-grid',
        title: 'World Grid',
        tags: ['world', 'space'],
        description: 'An empty panoramic field with a softly rounded rectangular horizon.',
        layout: 'panoramic',
        includeInAll: false,
        showCaption: false,
    },
    view: {
        cubeSize: GRID_CELL_SIZE,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 48,
        gridOpacity: 0.5,
        gridVisibility: {
            shape: 'rounded-rectangle',
            widthCells: 33,
            heightCells: 19,
            cornerRadiusCells: 3,
            fadeCells: 2.5,
        },
        mainCubeEnabled: false,
        cameraAzimuthDeg: 45,
        cameraDistance: 1.45,
        viewOffsetY: -0.08,
        hoverCells: 0,
    },
})
