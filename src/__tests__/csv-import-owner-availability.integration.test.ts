import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { owners } from '~/server/db/schema/owners'
import { executeCsvImport } from '~/server/lib/import/csv-importer'
import { createOwner } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

describe('executeCsvImport — suivi des disponibilités', () => {
  it('laisse le bailleur soumis à la règle de fraîcheur, en comptant à partir de l’import', async () => {
    const owner = await createOwner({ slug: 'bailleur-csv' })
    const before = new Date()

    await executeCsvImport('owner_slug;name\nbailleur-csv;\n', 'csv', vi.fn())

    const [row] = await getTestDb().select().from(owners).where(eq(owners.id, owner.id))
    expect(row.availabilityImported).toBe(false)
    expect(row.availabilityTrackedSince?.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })
})
