import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')

/** Runtime counterparts to the aliases declared in the root tsconfig. */
export const SOURCE_ALIASES = {
    '@app': path.resolve(repoRoot, 'src'),
    '@components': path.resolve(repoRoot, 'src/components'),
    '@scenes': path.resolve(repoRoot, 'src/scenes'),
    '@sdk': path.resolve(repoRoot, 'src/sdk'),
    '@styles': path.resolve(repoRoot, 'src/styles'),
    '@tests': path.resolve(repoRoot, 'tests'),
}
