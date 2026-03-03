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
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts'],
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
          include: ['src/**/*.integration.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          setupFiles: ['src/__tests__/helpers/setup-integration.ts'],
          fileParallelism: false,
          env: {
            BASE_URL: 'http://localhost:3000',
            AUTH_SECRET: 'test-secret-for-integration-tests',
          },
        },
      },
    ],
  },
})
