import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import { SOURCE_ALIASES } from './aliases.js'

const injectLibraryCss = (): Plugin => ({
    name: 'inject-cube-illustrations-css',
    generateBundle(_options, bundle): void {
        for (const output of Object.values(bundle)) {
            if (output.type === 'chunk' && output.isEntry && output.fileName === 'index.js') {
                output.code = `import './styles.css';\n${output.code}`
            }
        }
    },
})

export default defineConfig({
    plugins: [react(), injectLibraryCss()],
    resolve: {
        alias: SOURCE_ALIASES,
    },
    build: {
        lib: {
            entry: {
                index: fileURLToPath(new URL('../src/app/bundle.ts', import.meta.url)),
                'sdk/index': fileURLToPath(new URL('../src/sdk/index.ts', import.meta.url)),
            },
            formats: ['es'],
            fileName: (_format, entryName) => `${entryName}.js`,
            cssFileName: 'styles',
        },
        rollupOptions: {
            external: ['react', 'react/jsx-runtime', 'three', 'three/webgpu'],
        },
    },
})
