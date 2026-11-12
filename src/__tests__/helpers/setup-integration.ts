import { afterAll, beforeEach } from 'vitest'
import { cleanTables, teardownTestDb } from './test-db'

beforeEach(async () => {
  await cleanTables()
})

afterAll(async () => {
  await teardownTestDb()
})
