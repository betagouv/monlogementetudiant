import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import type { TypologyDraft } from '~/server/lib/typologies'
import { DAY_MS } from '~/utils/time'
import { createAccommodation, createExternalSource, createOwner, createUser } from './fixtures/factories'
import { adminCaller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS)

const studio = (nbAvailable: number | null): TypologyDraft => ({
  type: 't1',
  priceMin: 400,
  priceMax: 500,
  superficieMin: 18,
  superficieMax: 20,
  nbTotal: 10,
  nbAvailable,
  colocation: false,
})

async function stampAvailability(accommodationId: number, at: Date) {
  await getTestDb()
    .update(accommodationTypologies)
    .set({ availabilityUpdatedAt: at })
    .where(eq(accommodationTypologies.accommodationId, accommodationId))
}

beforeEach(async () => {
  await createUser({ id: 'test-admin-id', role: 'admin' })
})

describe('admin.stats.overview — suivi des mises à jour de disponibilité', () => {
  it('classe les résidences publiées hors CROUS selon la fraîcheur de leur disponibilité', async () => {
    const manual = await createOwner({ slug: 'manuel' })
    const imported = await createOwner({ slug: 'importe', availabilityImported: true })

    const recentManual = await createAccommodation({ ownerId: manual.id }, [studio(2)])
    await stampAvailability(recentManual.id, daysAgo(5))

    const staleManual = await createAccommodation({ ownerId: manual.id }, [studio(2)])
    await stampAvailability(staleManual.id, daysAgo(45))

    await createAccommodation({ ownerId: manual.id }, [studio(null)])
    await createAccommodation({ ownerId: imported.id, updatedAt: daysAgo(1) }, [studio(3)])
    await createAccommodation({ ownerId: imported.id, updatedAt: daysAgo(60) }, [studio(3)])

    await createAccommodation({ ownerId: manual.id, published: false }, [studio(2)])
    const crous = await createAccommodation({ ownerId: imported.id, updatedAt: daysAgo(1) }, [studio(3)])
    await createExternalSource({ accommodationId: crous.id, source: 'crous', sourceId: 'crous-1' })

    const { suiviDispo } = await adminCaller.admin.stats.overview()

    expect(suiviDispo).toEqual({
      recentDays: 30,
      total: 5,
      recent: 2,
      recentImported: 1,
      nonRenseignee: 1,
      ancienne: 2,
    })
  })
})
