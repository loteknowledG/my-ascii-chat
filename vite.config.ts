import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { mechanicusCursorBridge } from './vite-plugin-mechanicus-cursor-bridge'
import { vscodeVoiceBridge } from './vite-plugin-vscode-voice-bridge'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: './', // Tells the app: "Find my files here on the disk, not a server"
  plugins: [react(), mechanicusCursorBridge(__dirname), vscodeVoiceBridge(__dirname)],
  server: {
    /** Same-origin TTS in dev so VoiceCard can use profile `browserVoice` without a public CORS proxy. */
    proxy: {
      '/api/tts': {
        target: 'https://aivoice.coderobo.org',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist'
  }
});
