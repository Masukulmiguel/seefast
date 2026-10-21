import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}', 'server/**/*.test.js', 'scripts/**/*.test.js'],
    // Cada worker jsdom paga o arranque do jsdom (dezenas de segundos em
    // maquinas lentas ou com antivirus a analisar). Poucos workers em
    // paralelo = arranque mais rapido e suite estavel.
    maxWorkers: 2
  }
})
