import { afterAll, beforeAll, beforeEach } from 'vitest'
import { cleanTables, setupTestDb, teardownTestDb } from './test-db'

beforeAll(async () => {
  await setupTestDb()
})

beforeEach(async () => {
  await cleanTables()
})

afterAll(async () => {
  await teardownTestDb()
})
