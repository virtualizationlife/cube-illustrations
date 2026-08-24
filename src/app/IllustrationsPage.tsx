import type { JSX } from 'react'

import { SCENE_CATALOG } from '@app/sceneCatalog'
import { SceneRenderHost } from '@runtime/rendering/SceneRenderHost'

export const IllustrationsPage = (): JSX.Element => (
    <SceneRenderHost>
        <div className='cube_illustrations__page'>
            {SCENE_CATALOG.map(({ id, title, tags, component: SceneComponent }) => (
                <div className='cube_illustrations__labeled_scene' key={id}>
                    <SceneComponent />
                    <p className='cube_illustrations__scene_label'>{title}</p>
                    <p className='cube_illustrations__scene_tags'>{tags.join(', ')}</p>
                </div>
            ))}
        </div>
    </SceneRenderHost>
)
