import { afterAll, beforeEach } from 'vitest'
import { installExternalFetchStub } from './external-fetch-stub'
import { cleanTables, teardownTestDb } from './test-db'

installExternalFetchStub()

beforeEach(async () => {
  await cleanTables()
})

afterAll(async () => {
  await teardownTestDb()
})
