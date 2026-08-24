import type { JSX } from 'react'

import { SCENE_CATALOG } from '@app/sceneCatalog'
import { SceneRenderHost } from '@runtime/rendering/SceneRenderHost'

import { ALL_SCENES_GROUP, SceneGalleryProvider, useSceneGallery } from './SceneGalleryContext'
import { SceneGroupSwitcher } from './SceneGroupSwitcher'

const IllustrationsContent = (): JSX.Element => {
    const { activeGroup } = useSceneGallery()
    const visibleScenes =
        activeGroup === ALL_SCENES_GROUP
            ? SCENE_CATALOG
            : SCENE_CATALOG.filter(({ primaryCategory }) => primaryCategory === activeGroup)

    return (
        <SceneRenderHost>
            <div className='cube_illustrations__page'>
                <SceneGroupSwitcher />
                {visibleScenes.map(({ id, title, tags, component: SceneComponent }) => (
                    <div className='cube_illustrations__labeled_scene' key={id}>
                        <SceneComponent />
                        <p className='cube_illustrations__scene_label'>{title}</p>
                        <p className='cube_illustrations__scene_tags'>{tags.join(', ')}</p>
                    </div>
                ))}
            </div>
        </SceneRenderHost>
    )
}

export const IllustrationsPage = (): JSX.Element => (
    <SceneGalleryProvider>
        <IllustrationsContent />
    </SceneGalleryProvider>
)
