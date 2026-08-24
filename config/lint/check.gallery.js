import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const lintDirectory = path.dirname(fileURLToPath(import.meta.url))
const galleryDirectory = path.resolve(lintDirectory, '../../src/gallery')
const categories = new Set([
    'structure',
    'movement',
    'flow',
    'mind',
    'continuity',
    'interaction',
    'cycles',
    'world',
])
const errors = []

for (const categoryEntry of fs.readdirSync(galleryDirectory, { withFileTypes: true })) {
    if (!categoryEntry.isDirectory()) continue
    const category = categoryEntry.name
    if (!categories.has(category)) {
        errors.push(`unknown gallery category folder: ${category}`)
        continue
    }

    const categoryDirectory = path.join(galleryDirectory, category)
    for (const sceneEntry of fs.readdirSync(categoryDirectory, { withFileTypes: true })) {
        if (!sceneEntry.isFile() || !sceneEntry.name.endsWith('.tsx')) continue
        const filename = path.join(categoryDirectory, sceneEntry.name)
        const source = fs.readFileSync(filename, 'utf8')
        const matches = [...source.matchAll(/primaryCategory:\s*'([^']+)'/g)].map(
            (match) => match[1]
        )

        if (matches.length === 0) {
            errors.push(`${path.relative(galleryDirectory, filename)} has no primaryCategory`)
            continue
        }

        for (const primaryCategory of matches) {
            if (primaryCategory !== category) {
                errors.push(
                    `${path.relative(galleryDirectory, filename)} declares ${primaryCategory}, but lives in ${category}`
                )
            }
        }
    }
}

if (errors.length > 0) {
    for (const error of errors) console.error(`[gallery] ${error}`)
    process.exitCode = 1
} else {
    console.log('[gallery] primaryCategory values match gallery folders.')
}
