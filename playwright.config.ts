import { defineConfig, devices } from '@playwright/test'

/**
 * Tests e2e : parcours critiques dans un vrai navigateur, contre un serveur Next local
 * branché sur la base dédiée `mle_e2e` (conteneur db-test, seedée via `pnpm e2e:seed`).
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  // Le serveur e2e tourne en mode dev : les premières visites compilent les pages, ce qui peut
  // dépasser les 5 s par défaut quand plusieurs workers sollicitent le serveur en parallèle.
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:3210',
    locale: 'fr-FR',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'NEXT_DIST_DIR=.next-e2e DATABASE_URL=postgres://test:test@localhost:5491/mle_e2e pnpm exec next dev -p 3210',
    url: 'http://localhost:3210',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
