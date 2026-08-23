import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
    root: fileURLToPath(new URL('./demo', import.meta.url)),
    plugins: [react()],
})
