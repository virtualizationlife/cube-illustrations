import { useCallback, useRef, type JSX } from 'react'

import { GRID_CUBE_FACES, type GridCubeFace, type GridCubeFaceLabels } from '@scenes/cubeFaceLabels'
import { FaceFlipCubeScene } from '@scenes/FaceFlipCubeScene'
import { getRandomIndex } from '@scenes/sceneRandom'
import { attachSceneMetadata } from '@sdk/defineScene'

const GRID_CELL_SIZE = 0.1
const LETTERS = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ')

const INITIAL_FACE_LABELS: GridCubeFaceLabels = {
    front: 'V',
    right: 'L',
    top: 'L',
    back: 'A',
    left: 'R',
    bottom: 'T',
}

export type VllCubeSceneProps = {
    /** Cube corner radius in world units. Defaults to 3% of the cube edge. */
    readonly cubeCornerRadius?: number
}

/** A rotating identity cube receives distinct random letters after every turn. */
const VllCubeSceneComponent = ({ cubeCornerRadius }: VllCubeSceneProps): JSX.Element => {
    const labelsRef = useRef<GridCubeFaceLabels>({ ...INITIAL_FACE_LABELS })
    const updateHiddenFaceLabels = useCallback(
        (hiddenFaces: readonly GridCubeFace[]): GridCubeFaceLabels => {
            const nextLabels: GridCubeFaceLabels = { ...labelsRef.current }
            const hiddenFaceSet = new Set(hiddenFaces)
            const visibleLetters = new Set(
                GRID_CUBE_FACES.filter((face) => !hiddenFaceSet.has(face))
                    .map((face) => nextLabels[face])
                    .filter((letter): letter is string => letter !== undefined)
            )
            const availableLetters = LETTERS.filter((letter) => !visibleLetters.has(letter))

            for (const face of hiddenFaces) {
                const index = getRandomIndex(availableLetters.length)
                const [letter] = availableLetters.splice(index, 1)
                nextLabels[face] = letter ?? 'A'
            }
            labelsRef.current = nextLabels
            return nextLabels
        },
        []
    )

    return (
        <FaceFlipCubeScene
            cubeSize={GRID_CELL_SIZE}
            cubeCornerRadius={cubeCornerRadius}
            gridCellSize={GRID_CELL_SIZE}
            gridCellCount={9}
            cameraAzimuthDeg={45}
            viewOffsetY={0}
            hoverCells={0}
            mainCubeFaceLabels={INITIAL_FACE_LABELS}
            flipLiftCells={1}
            nextFaceLabels={updateHiddenFaceLabels}
        />
    )
}

export const VllCubeScene = attachSceneMetadata(VllCubeSceneComponent, {
    id: 'vll-cube',
    title: 'VLL Cube',
    tags: ['identity', 'symbol'],
    description: 'An identity cube relettering its hidden faces.',
})
