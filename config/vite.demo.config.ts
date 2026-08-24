import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { SOURCE_ALIASES } from './aliases.js'

export default defineConfig({
    root: fileURLToPath(new URL('../demo', import.meta.url)),
    plugins: [react()],
    resolve: {
        alias: SOURCE_ALIASES,
    },
})
