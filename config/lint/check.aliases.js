import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const lintDirectory = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(lintDirectory, '../..')
const tsconfigPath = path.join(root, 'tsconfig.json')
const expectedAliases = {
    '@app/*': ['src/*'],
    '@components/*': ['src/components/*'],
    '@scenes/*': ['src/scenes/*'],
    '@sdk/*': ['src/sdk/*'],
    '@styles/*': ['src/styles/*'],
    '@tests/*': ['tests/*'],
}

const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'))
const compilerOptions = tsconfig.compilerOptions ?? {}
const actualAliases = compilerOptions.paths ?? {}
const errors = []

if (compilerOptions.baseUrl !== '.') {
    errors.push('tsconfig.json must set compilerOptions.baseUrl to "."')
}

for (const [alias, targets] of Object.entries(expectedAliases)) {
    if (JSON.stringify(actualAliases[alias]) !== JSON.stringify(targets)) {
        errors.push(`tsconfig.json is missing or has an incorrect alias: ${alias}`)
    }
}

if (errors.length > 0) {
    for (const error of errors) console.error(`[aliases] ${error}`)
    process.exitCode = 1
} else {
    console.log(`[aliases] ${Object.keys(expectedAliases).length} aliases configured.`)
}
