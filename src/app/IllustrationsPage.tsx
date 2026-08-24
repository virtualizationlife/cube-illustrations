import type { JSX } from 'react'

import { getSceneCatalogEntries } from '@app/sceneCatalog'
import { SceneRenderHost } from '@runtime/rendering/SceneRenderHost'

import { ALL_SCENES_GROUP, SceneGalleryProvider, useSceneGallery } from './SceneGalleryContext'
import { SceneGroupSwitcher } from './SceneGroupSwitcher'

const IllustrationsContent = (): JSX.Element => {
    const { activeGroup } = useSceneGallery()
    const visibleScenes = getSceneCatalogEntries(
        activeGroup === ALL_SCENES_GROUP ? null : activeGroup
    )

    return (
        <SceneRenderHost>
            <div className='cube_illustrations_page'>
                <SceneGroupSwitcher />
                {visibleScenes.map(
                    ({
                        id,
                        title,
                        tags,
                        layout,
                        showCaption = true,
                        component: SceneComponent,
                    }) => (
                        <div
                            className={`cube_illustrations_labeled_scene cube_illustrations_labeled_scene_${layout ?? 'standard'}`}
                            key={id}
                        >
                            <SceneComponent />
                            {showCaption && (
                                <>
                                    <div className='cube_illustrations_scene_label'>{title}</div>
                                    <div className='cube_illustrations_scene_tags'>
                                        {tags.join(', ')}
                                    </div>
                                </>
                            )}
                        </div>
                    )
                )}
            </div>
        </SceneRenderHost>
    )
}

export const IllustrationsPage = (): JSX.Element => (
    <SceneGalleryProvider>
        <IllustrationsContent />
    </SceneGalleryProvider>
)
