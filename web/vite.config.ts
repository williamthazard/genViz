import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// For GitHub Pages: repo lives at https://<user>.github.io/genscape/.
// Overridable via VITE_BASE for custom domains / other hosts.
const base = process.env.VITE_BASE ?? '/genscape/'

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, '../js/src'),
    },
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
})
