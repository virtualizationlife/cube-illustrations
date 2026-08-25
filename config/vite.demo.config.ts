import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { SOURCE_ALIASES } from './aliases.js'

export default defineConfig({
    base: process.env.DEMO_BASE ?? '/',
    root: fileURLToPath(new URL('../demo', import.meta.url)),
    plugins: [react()],
    resolve: {
        alias: SOURCE_ALIASES,
    },
    build: {
        outDir: fileURLToPath(new URL('../dist-demo', import.meta.url)),
        emptyOutDir: true,
    },
})
