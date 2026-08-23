import type { JSX } from 'react'

import { CenteredCubeScene } from './CenteredCubeScene'

export interface VvlCubeSceneProps {
    /** Cube corner radius in world units. Defaults to 5% of the cube edge. */
    readonly cubeCornerRadius?: number
}

/** A centered cube with V, V, and L on its three visible faces. */
export const VvlCubeScene = ({ cubeCornerRadius }: VvlCubeSceneProps = {}): JSX.Element => (
    <CenteredCubeScene
        cubeCornerRadius={cubeCornerRadius}
        faceLabels={{
            front: 'V',
            right: 'V',
            top: 'L',
        }}
    />
)
