import type { JSX } from 'react'

import { CenteredCubeScene } from './CenteredCubeScene'

/** A centered cube with V, V, and L on its three visible faces. */
export const VvlCubeScene = (): JSX.Element => (
    <CenteredCubeScene
        faceLabels={{
            front: 'V',
            right: 'V',
            top: 'L',
        }}
    />
)
