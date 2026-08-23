import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const injectLibraryCss = (): Plugin => ({
    name: 'inject-cube-illustrations-css',
    generateBundle(_options, bundle): void {
        for (const output of Object.values(bundle)) {
            if (output.type === 'chunk' && output.isEntry) {
                output.code = `import './styles.css';\n${output.code}`
            }
        }
    },
})

export default defineConfig({
    plugins: [react(), injectLibraryCss()],
    build: {
        lib: {
            entry: fileURLToPath(new URL('./src/bundle.ts', import.meta.url)),
            formats: ['es'],
            fileName: 'index',
            cssFileName: 'styles',
        },
        rollupOptions: {
            external: ['react', 'react/jsx-runtime', 'three', 'three/webgpu'],
        },
    },
})
