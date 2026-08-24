import { type KeyboardEvent, type JSX } from 'react'

import { SCENE_GROUPS, useSceneGallery, type SceneGroup } from './SceneGalleryContext'

import '@styles/scene_switcher.css'

const GROUP_LABELS: Readonly<Record<SceneGroup, string>> = {
    all: 'all',
    structure: 'structure',
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
        <div
            aria-label='scene groups'
            className='cube_illustrations__scene_group_switcher'
            role='tablist'
        >
            {SCENE_GROUPS.map((group) => {
                const isActive = group === activeGroup

                return (
                    <div
                        aria-selected={isActive}
                        className='cube_illustrations__scene_group_switcher_item'
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
    )
}
