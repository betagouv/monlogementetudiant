import { describe, expect, it } from 'vitest'
import { latestAppliedMigration, latestJournalMigration, waitForMigrations } from './wait-for-migrations'

describe('migrations Drizzle de la base de test', () => {
  it('la dernière migration appliquée couvre le journal', async () => {
    expect(await latestAppliedMigration()).toBeGreaterThanOrEqual(latestJournalMigration())
  })

  it('waitForMigrations résout', async () => {
    await expect(waitForMigrations({ timeoutMs: 1000 })).resolves.toBeUndefined()
  })
})
