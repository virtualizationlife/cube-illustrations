import type { JSX } from 'react'

import { SceneRenderHost, type SceneCatalogEntry } from '@app/index'

type SingleScenePageProps = {
    readonly component: SceneCatalogEntry['component']
}

export const SingleScenePage = ({ component: SceneComponent }: SingleScenePageProps): JSX.Element => (
    <SceneRenderHost>
        <SceneComponent />
    </SceneRenderHost>
)
