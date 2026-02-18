import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages deployment
  // Use './' for relative paths or '/your-repo-name/' for absolute paths
  // Set VITE_BASE_PATH env variable or defaults to './' for hash-based routing
  base: process.env.VITE_BASE_PATH || './',
  build: {
    outDir: 'dist',
  },
})
