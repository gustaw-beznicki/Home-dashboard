import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    globals: true,
    // e2e/ is Playwright's (npm run test:e2e) — Vitest's default include
    // would otherwise try to run those specs in jsdom and fail.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
