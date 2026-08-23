import type { JSX } from 'react'

import { CenteredCubeScene } from './CenteredCubeScene'

export interface VllCubeSceneProps {
    /** Cube corner radius in world units. Defaults to 3% of the cube edge. */
    readonly cubeCornerRadius?: number
}

/** A centered cube with V, L, and L on its three visible faces. */
export const VllCubeScene = ({ cubeCornerRadius }: VllCubeSceneProps = {}): JSX.Element => (
    <CenteredCubeScene
        cubeCornerRadius={cubeCornerRadius}
        faceLabels={{
            front: 'V',
            right: 'L',
            top: 'L',
        }}
    />
)
