import { afterAll, beforeEach } from 'vitest'
import { installExternalFetchStub } from './external-fetch-stub'
import { cleanTables, teardownTestDb, workerDatabaseUrl } from './test-db'

// Le code applicatif qui ouvre sa propre connexion (`env.DATABASE_URL`) doit viser la base du worker.
// Aucun import ci-dessus ne charge `~/server/env` : l'affectation précède donc sa validation.
process.env.DATABASE_URL = workerDatabaseUrl()

installExternalFetchStub()

beforeEach(async () => {
  await cleanTables()
})

afterAll(async () => {
  await teardownTestDb()
})
