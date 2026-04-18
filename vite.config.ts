import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mechanicusCursorBridge } from './vite-plugin-mechanicus-cursor-bridge'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: './', // Tells the app: "Find my files here on the disk, not a server"
  plugins: [react(), mechanicusCursorBridge(__dirname)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist'
  }
})
