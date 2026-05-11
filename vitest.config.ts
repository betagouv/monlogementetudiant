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
          env: {
            BASE_URL: 'http://localhost:3000',
            AUTH_SECRET: 'test-secret',
            DATABASE_URL: 'postgres://test:test@localhost:5432/test',
            BREVO_API_KEY: 'test-brevo-key',
            BREVO_TEMPLATE_MAGIC_LINK: '1',
            BREVO_TEMPLATE_VALIDATION: '1',
            BREVO_TEMPLATE_RESET_PASSWORD: '1',
            BREVO_TEMPLATE_OWNER_WELCOME: '1',
            S3_ENDPOINT: 'https://s3.example.com',
            S3_BUCKET: 'test-bucket',
            S3_ACCESS_KEY_ID: 'test-key-id',
            S3_SECRET_ACCESS_KEY: 'test-secret-key',
            MATOMO_URL: 'https://matomo.example.com/',
            MATOMO_TOKEN: 'test-token',
            MATOMO_ID_SITE: '1',
          },
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
            DATABASE_URL: 'postgres://test:test@localhost:5491/mle_test',
            BREVO_API_KEY: 'test-brevo-api-key',
            BREVO_TEMPLATE_MAGIC_LINK: '1',
            BREVO_TEMPLATE_VALIDATION: '1',
            BREVO_TEMPLATE_RESET_PASSWORD: '1',
            BREVO_TEMPLATE_OWNER_WELCOME: '1',
            S3_ENDPOINT: 'https://s3.example.com',
            S3_BUCKET: 'test-bucket',
            S3_ACCESS_KEY_ID: 'test-key-id',
            S3_SECRET_ACCESS_KEY: 'test-secret-key',
            MATOMO_URL: 'https://matomo.example.com/',
            MATOMO_TOKEN: 'test-token',
            MATOMO_ID_SITE: '1',
            IBAIL_API_HOST: 'https://ibail.example.com',
            IBAIL_API_AUTH_KEY: 'test-key',
            IBAIL_API_AUTH_SECRET: 'test-secret',
          },
        },
      },
    ],
  },
})
