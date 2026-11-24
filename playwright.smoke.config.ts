import { defineConfig, devices } from '@playwright/test'
import { baseURL, isLocal } from './e2e-smoke/target'

if (isLocal) process.loadEnvFile('.env.e2e')

export default defineConfig({
  testDir: 'e2e-smoke',
  outputDir: 'test-results-smoke',
  fullyParallel: true,
  workers: isLocal ? undefined : 3,
  retries: isLocal ? 0 : 1,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-smoke', open: 'never' }]],
  use: {
    baseURL,
    locale: 'fr-FR',
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    trace: 'on-first-retry',
    ...(isLocal ? {} : { launchOptions: { slowMo: 800 } }),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(isLocal
    ? {
        webServer: {
          command: `NEXT_DIST_DIR=.next-e2e pnpm exec next dev -p ${new URL(baseURL).port}`,
          url: baseURL,
          reuseExistingServer: true,
          timeout: 180_000,
        },
      }
    : {}),
})
