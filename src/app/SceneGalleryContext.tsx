import {
    createContext,
    useContext,
    useState,
    type Dispatch,
    type JSX,
    type SetStateAction,
} from 'react'

import { SCENE_CATEGORIES, type SceneCategory } from '@sdk/defineScene'

export const ALL_SCENES_GROUP = 'all' as const

export type SceneGroup = typeof ALL_SCENES_GROUP | SceneCategory

export type SceneGalleryContextValue = {
    readonly activeGroup: SceneGroup
    readonly setActiveGroup: Dispatch<SetStateAction<SceneGroup>>
}

export type SceneGalleryProviderProps = {
    readonly children: JSX.Element | readonly JSX.Element[]
    readonly initialGroup?: SceneGroup
}

const SceneGalleryContext = createContext<SceneGalleryContextValue | null>(null)

export const SceneGalleryProvider = ({
    children,
    initialGroup = ALL_SCENES_GROUP,
}: SceneGalleryProviderProps): JSX.Element => {
    const [activeGroup, setActiveGroup] = useState<SceneGroup>(initialGroup)

    return (
        <SceneGalleryContext.Provider value={{ activeGroup, setActiveGroup }}>
            {children}
        </SceneGalleryContext.Provider>
    )
}

export const useSceneGallery = (): SceneGalleryContextValue => {
    const context = useContext(SceneGalleryContext)

    if (context === null) {
        throw new Error('useSceneGallery must be used within a SceneGalleryProvider')
    }

    return context
}

export const SCENE_GROUPS: readonly SceneGroup[] = [ALL_SCENES_GROUP, ...SCENE_CATEGORIES]
