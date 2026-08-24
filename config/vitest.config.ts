import { defineConfig } from 'vitest/config'

import { SOURCE_ALIASES } from './aliases.js'

export default defineConfig({
    resolve: {
        alias: SOURCE_ALIASES,
    },
})
