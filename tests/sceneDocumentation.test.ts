import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { SCENE_CATALOG } from '@app/sceneCatalog'

const SCENES_DOC = fileURLToPath(new URL('../docs/SCENES.md', import.meta.url))

/** `## 12. Memory Replay (`MemoryReplayScene`)` and its `###` variant. */
const SCENE_HEADING = /^#{2,3} \d+\. (.+?) \(`(\w+)`\)/gm

const readDocumentedScenes = (): { title: string; component: string }[] => {
    const document = readFileSync(SCENES_DOC, 'utf8')
    return [...document.matchAll(SCENE_HEADING)].map((match) => ({
        title: match[1] ?? '',
        component: match[2] ?? '',
    }))
}

/**
 * The gallery is the source of truth. This keeps the scene list in the documentation from
 * quietly drifting away from it, without generating the hand-written prose around it.
 */
describe('scene documentation', () => {
    it('documents exactly the scenes the gallery shows', () => {
        const documented = readDocumentedScenes()
            .map((scene) => scene.title)
            .sort()
        const catalogued = SCENE_CATALOG.map((entry) => entry.title).sort()
        expect(documented).toEqual(catalogued)
    })

    it('numbers the scene sections without gaps or repeats', () => {
        const document = readFileSync(SCENES_DOC, 'utf8')
        const numbers = [...document.matchAll(/^#{2,3} (\d+)\. /gm)].map((match) =>
            Number(match[1])
        )
        expect(numbers).toEqual(numbers.map((_, index) => index + 1))
    })
})
