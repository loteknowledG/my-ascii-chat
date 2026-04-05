import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // Tells the app: "Find my files here on the disk, not a server"
  plugins: [react()],
  build: {
    outDir: 'dist'
  }
})