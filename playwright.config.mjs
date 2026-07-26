import { defineConfig } from 'playwright/test'

// E2E tests run against `wrangler dev` with the server-side dev bypass
// (ADR 0011) plus DEV_ONBOARDING, so the onboarding wizard is reachable
// without Google credentials. Port 8788 to stay clear of a dev server the
// developer may already have on 8787.
//
// Run: npm run test:e2e   (Vitest ignores e2e/ — see vite.config.js)
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  // The local D1 database is shared state, so no parallel workers.
  workers: 1,
  use: {
    baseURL: 'http://localhost:8788',
    deviceScaleFactor: 2,
    // Motion is decoration here; freezing it keeps screenshots reproducible.
    contextOptions: { reducedMotion: 'reduce' },
  },
  webServer: {
    command:
      'npm run build && npx wrangler dev --var DEV_NO_AUTH:true --var DEV_ONBOARDING:true --var ENVIRONMENT:development --port 8788',
    url: 'http://localhost:8788/api/whoami',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
