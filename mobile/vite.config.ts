import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [] } },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020' },
  server: { port: 5174 }
})
