import path from 'node:path'
import { defineConfig } from 'vitest/config'

const srcDir = path.resolve(__dirname, 'src')

export default defineConfig({
  resolve: {
    alias: {
      '~': srcDir,
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '~': srcDir,
          },
        },
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'cli/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts', 'cli/**/*.integration.test.ts'],
        },
      },
      {
        resolve: {
          alias: [
            { find: /^~\/server\/db$/, replacement: path.resolve(srcDir, '__tests__/helpers/test-db-module.ts') },
            { find: '~', replacement: srcDir },
          ],
        },
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts', 'cli/**/*.integration.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          setupFiles: ['src/__tests__/helpers/setup-integration.ts'],
          fileParallelism: false,
          env: {
            BASE_URL: 'http://localhost:3000',
            AUTH_SECRET: 'test-secret-for-integration-tests',
            BREVO_API_KEY: 'test-brevo-api-key',
            BREVO_TEMPLATE_MAGIC_LINK: '1',
            BREVO_TEMPLATE_VALIDATION: '1',
            BREVO_TEMPLATE_RESET_PASSWORD: '1',
            BREVO_TEMPLATE_OWNER_WELCOME: '1',
          },
        },
      },
    ],
  },
})
