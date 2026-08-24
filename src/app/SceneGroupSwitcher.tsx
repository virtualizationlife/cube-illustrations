import { type KeyboardEvent, type JSX } from 'react'

import { SCENE_GROUPS, useSceneGallery, type SceneGroup } from './SceneGalleryContext'
import { SCENE_GROUP_DESCRIPTIONS } from './sceneGroupDescriptions'

import '@styles/scene_switcher.css'

const GROUP_LABELS: Readonly<Record<SceneGroup, string>> = {
    all: 'all',
    structure: 'structure',
    movement: 'movement',
    flow: 'flow',
    mind: 'mind',
    continuity: 'continuity',
    interaction: 'interaction',
    cycles: 'cycles',
}

const activateGroupOnKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    group: SceneGroup,
    onGroupChange: (nextGroup: SceneGroup) => void
): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return

    event.preventDefault()
    onGroupChange(group)
}

export const SceneGroupSwitcher = (): JSX.Element => {
    const { activeGroup, setActiveGroup } = useSceneGallery()

    return (
        <div className='cube_illustrations_scene_group_switcher'>
            <div
                aria-label='scene groups'
                className='cube_illustrations_scene_group_tabs'
                role='tablist'
            >
                {SCENE_GROUPS.map((group) => {
                    const isActive = group === activeGroup

                    return (
                        <div
                            aria-selected={isActive}
                            className='cube_illustrations_scene_group_switcher_item'
                            key={group}
                            onClick={() => {
                                setActiveGroup(group)
                            }}
                            onKeyDown={(event) => {
                                activateGroupOnKeyDown(event, group, setActiveGroup)
                            }}
                            role='tab'
                            tabIndex={isActive ? 0 : -1}
                        >
                            {GROUP_LABELS[group]}
                        </div>
                    )
                })}
            </div>
            <div className='cube_illustrations_scene_group_description'>
                {SCENE_GROUP_DESCRIPTIONS[activeGroup]}
            </div>
        </div>
    )
}
