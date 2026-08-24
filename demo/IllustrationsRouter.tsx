import type { JSX } from 'react'

import { IllustrationsPage, SCENE_CATALOG, type SceneCatalogEntry } from '@app/index'

import { SingleScenePage } from './SingleScenePage'

type IllustrationsRoute =
    | { readonly type: 'gallery' }
    | { readonly type: 'single-scene'; readonly component: SceneCatalogEntry['component'] }
    | { readonly type: 'not-found' }

const SCENE_NOT_FOUND_MESSAGE = 'Scene not found'

const isSingleScenePath = (pathname: string): boolean => pathname.startsWith('/scene/')

const findSingleScene = (pathname: string): SceneCatalogEntry | null => {
    const match = /^\/scene\/([^/]+)\/?$/.exec(pathname)
    if (match?.[1] === undefined) return null

    let sceneId: string
    try {
        sceneId = decodeURIComponent(match[1])
    } catch {
        return null
    }

    return SCENE_CATALOG.find((entry) => entry.id === sceneId) ?? null
}

export const resolveIllustrationsRoute = (pathname: string): IllustrationsRoute => {
    if (!isSingleScenePath(pathname)) return { type: 'gallery' }

    const scene = findSingleScene(pathname)
    return scene === null
        ? { type: 'not-found' }
        : { type: 'single-scene', component: scene.component }
}

export const renderIllustrationsRoute = (route: IllustrationsRoute): JSX.Element => {
    if (route.type === 'gallery') return <IllustrationsPage />
    if (route.type === 'not-found') return <main>{SCENE_NOT_FOUND_MESSAGE}</main>

    return <SingleScenePage component={route.component} />
}

export const IllustrationsRouter = (): JSX.Element =>
    renderIllustrationsRoute(resolveIllustrationsRoute(window.location.pathname))
