import { describe, expect, it } from 'vitest'

import * as publicApi from '../src/index'
import { SCENE_CATALOG } from '../src/sceneCatalog'
import catalogSnapshot from './support/catalogSnapshot.json'

/**
 * The snapshot was taken before the migration onto the scene SDK. Scene internals may be
 * rewritten freely; the gallery those scenes produce may not change.
 */
describe('SCENE_CATALOG', () => {
    it('keeps the gallery order, ids, titles and tags it had before the migration', () => {
        const live = SCENE_CATALOG.map(({ id, title, tags }) => ({
            id,
            title,
            tags: [...tags],
        }))
        expect(live).toEqual(catalogSnapshot)
    })

    it('gives every entry a component', () => {
        for (const entry of SCENE_CATALOG) {
            expect(entry.component, entry.id).toBeTypeOf('function')
        }
    })

    it('has no duplicate ids', () => {
        const ids = SCENE_CATALOG.map((entry) => entry.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    /**
     * Parameterised building blocks other scenes are composed from. They are exported for
     * consumers but are not gallery entries, so they carry no catalog metadata.
     */
    const SCENES_OUTSIDE_THE_GALLERY = [
        'FaceFlipCubeScene',
        'GridPathCubeScene',
        'InertiaCubeScene',
    ]

    it('lists every exported scene except the documented building blocks', () => {
        const catalogComponents = new Set(SCENE_CATALOG.map((entry) => entry.component))
        const exportedScenes = Object.entries(publicApi).filter(
            ([name, value]) => /^[A-Z].*Scene$/.test(name) && typeof value === 'function'
        )

        const uncatalogued = exportedScenes
            .filter(([, value]) => !catalogComponents.has(value as never))
            .map(([name]) => name)
            .sort()

        expect(uncatalogued).toEqual([...SCENES_OUTSIDE_THE_GALLERY].sort())
    })

    it('gives every entry a non-empty title and at least one tag', () => {
        for (const entry of SCENE_CATALOG) {
            expect(entry.title.length, entry.id).toBeGreaterThan(0)
            expect(entry.tags.length, entry.id).toBeGreaterThan(0)
        }
    })
})
