import { useCallback, type JSX } from 'react'

import { CubeSceneViewport } from '../scenes/CubeSceneViewport'
import type { CubeFaceLabelsProps } from '../scenes/cubeFaceLabels'
import { MAIN_CUBE_ID } from '../scenes/gridSceneRuntime'
import {
    useSimpleCubeScene,
    type SimpleCubeFrameContext,
    type SimpleCubeSetupContext,
} from '../scenes/useSimpleCubeScene'

const GRID_CELL_SIZE = 0.055
const OUTER_CUBE_SIZE = GRID_CELL_SIZE * 3
const INNER_CUBE_ID = 'nested-inner'
/** Keeps the outer shell see-through so the raised inner cube stays readable. */
const OUTER_OPACITY = 0.34

/** A three-cell cube on the ground contains a one-cell cube raised one cell above the floor. */
export const NestedCubeScene = ({
    faceLabels,
    cubeCornerRadius,
}: CubeFaceLabelsProps): JSX.Element => {
    const onSetup = useCallback(
        ({ runtime }: SimpleCubeSetupContext): undefined => {
            runtime.setCubeOpacity(MAIN_CUBE_ID, OUTER_OPACITY)
            runtime.addCube({
                id: INNER_CUBE_ID,
                position: { column: 0, row: 0 },
                size: GRID_CELL_SIZE,
                hoverCells: 1,
                occupiesCell: false,
                faceLabels,
            })
            return undefined
        },
        [faceLabels]
    )

    const onFrame = useCallback((_context: SimpleCubeFrameContext): void => {}, [])

    const { canvasRef, status } = useSimpleCubeScene({
        cubeSize: OUTER_CUBE_SIZE,
        cubeCornerRadius,
        gridCellSize: GRID_CELL_SIZE,
        gridCellCount: 13,
        gridFadeInnerRadiusCells: 2.5,
        gridFadeOuterRadiusCells: 7,
        cameraAzimuthDeg: 45,
        viewOffsetY: 0,
        hoverCells: 0,
        mainCubeFaceLabels: faceLabels,
        enableCubeHover: true,
        onSetup,
        onFrame,
    })

    return <CubeSceneViewport canvasRef={canvasRef} status={status} />
}
