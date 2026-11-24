import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  captureAvailabilitySnapshot,
  loadAvailabilityByOwner,
  loadAvailabilitySnapshotRows,
  loadFollowUpAdmins,
} from '~/server/admin/availability-follow-up'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { accommodations } from '~/server/db/schema/accommodations'
import { adminOwnerLinks } from '~/server/db/schema/admin-owner-links'
import { availabilityFollowUpSnapshots } from '~/server/db/schema/availability-snapshots'
import { typologyDraft } from '~/server/lib/typologies'
import { DAY_MS } from '~/utils/time'
import { createAccommodation, createExternalSource, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS)

async function setAvailabilityUpdatedAt(accommodationId: number, date: Date) {
  await getTestDb()
    .update(accommodationTypologies)
    .set({ availabilityUpdatedAt: date })
    .where(eq(accommodationTypologies.accommodationId, accommodationId))
}

async function setAccommodationUpdatedAt(accommodationId: number, date: Date) {
  await getTestDb().update(accommodations).set({ updatedAt: date }).where(eq(accommodations.id, accommodationId))
}

describe('loadAvailabilityByOwner', () => {
  it('compte résidences et logements par situation et segmente chaque gestionnaire', async () => {
    // Bon élève : une résidence renseignée récemment.
    const good = await createOwner({ name: 'Bon Élève', slug: 'bon-eleve' })
    const goodAccommodation = await createAccommodation({ ownerId: good.id, nbTotalApartments: 100 }, [
      typologyDraft('t1', { nbTotal: 100, nbAvailable: 10 }),
    ])
    await setAvailabilityUpdatedAt(goodAccommodation.id, daysAgo(1))

    // Irrégulier : une résidence à jour, une jamais renseignée.
    const irregular = await createOwner({ name: 'Irrégulier', slug: 'irregulier' })
    const irregularRecent = await createAccommodation({ ownerId: irregular.id, nbTotalApartments: 30 }, [
      typologyDraft('t1', { nbTotal: 30, nbAvailable: 2 }),
    ])
    await setAvailabilityUpdatedAt(irregularRecent.id, daysAgo(2))
    await createAccommodation({ ownerId: irregular.id, nbTotalApartments: 20 })

    // Mauvais élève : jamais rien renseigné.
    const bad = await createOwner({ name: 'Mauvais Élève', slug: 'mauvais-eleve' })
    await createAccommodation({ ownerId: bad.id, nbTotalApartments: 60 })

    const rows = await loadAvailabilityByOwner()
    const byName = new Map(rows.map((row) => [row.ownerName, row]))

    const goodRow = byName.get('Bon Élève')
    expect(goodRow?.segment).toBe('good')
    expect(goodRow?.recent).toEqual({ residences: 1, residencesApi: 0, apartments: 100, apartmentsApi: 0 })

    const irregularRow = byName.get('Irrégulier')
    expect(irregularRow?.segment).toBe('irregular')
    expect(irregularRow?.recent.apartments).toBe(30)
    expect(irregularRow?.missing).toEqual({ residences: 1, residencesApi: 0, apartments: 20, apartmentsApi: 0 })

    const badRow = byName.get('Mauvais Élève')
    expect(badRow?.segment).toBe('bad')
    expect(badRow?.missing.apartments).toBe(60)

    // Tri par taille de parc (en logements) décroissante.
    expect(rows.map((row) => row.ownerName)).toEqual(['Bon Élève', 'Mauvais Élève', 'Irrégulier'])
  })

  it('considère la date d’import comme mise à jour pour les résidences alimentées par API', async () => {
    const owner = await createOwner({ name: 'Bailleur API', slug: 'bailleur-api' })
    const accommodation = await createAccommodation({ ownerId: owner.id, nbTotalApartments: 40 }, [
      typologyDraft('t1', { nbTotal: 40, nbAvailable: 5 }),
    ])
    await createExternalSource({ accommodationId: accommodation.id, source: 'arpej' })
    // La typologie n'est pas horodatée (les imports API ne la stampent pas), mais l'import vient de passer.
    await setAvailabilityUpdatedAt(accommodation.id, daysAgo(90))
    await setAccommodationUpdatedAt(accommodation.id, daysAgo(1))

    const rows = await loadAvailabilityByOwner()
    const row = rows.find((r) => r.ownerName === 'Bailleur API')
    expect(row?.segment).toBe('good')
    expect(row?.recent).toEqual({ residences: 1, residencesApi: 1, apartments: 40, apartmentsApi: 40 })
  })

  it('classe en màj irrégulière une disponibilité de plus de 31 jours', async () => {
    const owner = await createOwner({ name: 'Bailleur Stale', slug: 'bailleur-stale' })
    const accommodation = await createAccommodation({ ownerId: owner.id, nbTotalApartments: 25 }, [
      typologyDraft('t1', { nbTotal: 25, nbAvailable: 1 }),
    ])
    // 70 jours : au-delà de la fenêtre de 31 jours.
    await setAvailabilityUpdatedAt(accommodation.id, daysAgo(70))
    await setAccommodationUpdatedAt(accommodation.id, daysAgo(70))

    const rows = await loadAvailabilityByOwner()
    const row = rows.find((r) => r.ownerName === 'Bailleur Stale')
    expect(row?.segment).toBe('irregular')
    expect(row?.stale).toEqual({ residences: 1, residencesApi: 0, apartments: 25, apartmentsApi: 0 })
  })

  it('classe en màj irrégulière une disponibilité renseignée mais jamais horodatée', async () => {
    const owner = await createOwner({ name: 'Bailleur Legacy', slug: 'bailleur-legacy' })
    const accommodation = await createAccommodation({ ownerId: owner.id, nbTotalApartments: 15 }, [
      typologyDraft('t1', { nbTotal: 15, nbAvailable: 4 }),
    ])
    // Données d'avant le tracking : la dispo existe mais n'a jamais été horodatée.
    await getTestDb()
      .update(accommodationTypologies)
      .set({ availabilityUpdatedAt: null })
      .where(eq(accommodationTypologies.accommodationId, accommodation.id))
    await setAccommodationUpdatedAt(accommodation.id, daysAgo(60))

    const rows = await loadAvailabilityByOwner()
    const row = rows.find((r) => r.ownerName === 'Bailleur Legacy')
    expect(row?.segment).toBe('irregular')
    expect(row?.stale).toEqual({ residences: 1, residencesApi: 0, apartments: 15, apartmentsApi: 0 })
  })

  it('compte 31 jours en dates, heure de Paris', async () => {
    // Relevé du 1er novembre 2026 (heure de Paris) : 31 jours avant = 1er octobre, quelle que soit l'heure.
    const now = new Date('2026-11-01T01:30:00Z')
    const owner = await createOwner({ name: 'Bailleur Mois', slug: 'bailleur-mois' })
    const october = await createAccommodation({ ownerId: owner.id, nbTotalApartments: 10 }, [
      typologyDraft('t1', { nbTotal: 10, nbAvailable: 1 }),
    ])
    // 1er octobre 00:30 à Paris (CEST) = 30 septembre 22:30 UTC.
    await setAvailabilityUpdatedAt(october.id, new Date('2026-09-30T22:30:00Z'))
    const september = await createAccommodation({ ownerId: owner.id, nbTotalApartments: 5 }, [
      typologyDraft('t1', { nbTotal: 5, nbAvailable: 1 }),
    ])
    // 30 septembre 23:30 à Paris = 21:30 UTC.
    await setAvailabilityUpdatedAt(september.id, new Date('2026-09-30T21:30:00Z'))
    await setAccommodationUpdatedAt(october.id, new Date('2026-09-01T00:00:00Z'))
    await setAccommodationUpdatedAt(september.id, new Date('2026-09-01T00:00:00Z'))

    const rows = await loadAvailabilityByOwner(now)
    const row = rows.find((r) => r.ownerName === 'Bailleur Mois')
    expect(row?.recent.apartments).toBe(10)
    expect(row?.stale.apartments).toBe(5)
  })

  it('rattache chaque gestionnaire à ses admins référents', async () => {
    const yasmine = await createUser({ id: 'admin-yasmine', role: 'admin', name: 'Yasmine' })
    const cecilia = await createUser({ id: 'admin-cecilia', role: 'admin', name: 'Cécilia' })
    const followed = await createOwner({ name: 'Suivi', slug: 'suivi' })
    const unassigned = await createOwner({ name: 'Non suivi', slug: 'non-suivi' })
    await createAccommodation({ ownerId: followed.id, nbTotalApartments: 10 })
    await createAccommodation({ ownerId: unassigned.id, nbTotalApartments: 10 })
    await getTestDb()
      .insert(adminOwnerLinks)
      .values([
        { userId: yasmine.id, ownerId: followed.id },
        { userId: cecilia.id, ownerId: followed.id },
      ])

    const rows = await loadAvailabilityByOwner()
    expect(rows.find((r) => r.ownerName === 'Suivi')?.adminIds).toEqual(['admin-cecilia', 'admin-yasmine'])
    expect(rows.find((r) => r.ownerName === 'Non suivi')?.adminIds).toEqual([])
    expect(await loadFollowUpAdmins()).toEqual([
      { id: 'admin-cecilia', name: 'Cécilia' },
      { id: 'admin-yasmine', name: 'Yasmine' },
    ])
  })

  it('regroupe les résidences sans gestionnaire et exclut CROUS et non publiées', async () => {
    await createAccommodation({ nbTotalApartments: 10 })

    const crous = await createAccommodation({ nbTotalApartments: 99 })
    await createExternalSource({ accommodationId: crous.id, source: 'crous' })

    await createAccommodation({ published: false, nbTotalApartments: 77 })

    const rows = await loadAvailabilityByOwner()
    expect(rows).toHaveLength(1)
    expect(rows[0].ownerName).toBe('Sans gestionnaire')
    expect(rows[0].missing.apartments).toBe(10)
  })
})

describe('captureAvailabilitySnapshot', () => {
  beforeEach(async () => {
    const owner = await createOwner({ name: 'Bailleur Snapshot', slug: 'bailleur-snapshot' })
    const accommodation = await createAccommodation({ ownerId: owner.id, nbTotalApartments: 12 }, [
      typologyDraft('t1', { nbTotal: 12, nbAvailable: 3 }),
    ])
    await setAvailabilityUpdatedAt(accommodation.id, daysAgo(1))
    await createAccommodation({ nbTotalApartments: 8 })
  })

  it('fige une ligne par gestionnaire, y compris « sans gestionnaire »', async () => {
    const result = await captureAvailabilitySnapshot(new Date('2026-11-01T02:00:00Z'))
    expect(result).toEqual({ capturedOn: '2026-11-01', owners: 2 })

    const stored = await getTestDb().select().from(availabilityFollowUpSnapshots)
    expect(stored).toHaveLength(2)
    const withOwner = stored.find((row) => row.ownerId !== null)
    expect(withOwner?.recentApartments).toBe(12)
    const withoutOwner = stored.find((row) => row.ownerId === null)
    expect(withoutOwner?.missingApartments).toBe(8)
  })

  it('est rejouable le même jour sans créer de doublon', async () => {
    await captureAvailabilitySnapshot(new Date('2026-11-01T02:00:00Z'))
    await captureAvailabilitySnapshot(new Date('2026-11-01T06:00:00Z'))

    const stored = await getTestDb().select().from(availabilityFollowUpSnapshots)
    expect(stored).toHaveLength(2)
  })

  it('restitue les relevés par gestionnaire et par date, avec leur segment', async () => {
    await captureAvailabilitySnapshot(new Date('2026-10-01T02:00:00Z'))
    await captureAvailabilitySnapshot(new Date('2026-11-01T02:00:00Z'))

    const rows = await loadAvailabilitySnapshotRows()
    expect(rows.map((row) => row.capturedOn)).toEqual(['2026-10-01', '2026-10-01', '2026-11-01', '2026-11-01'])
    const october = rows.filter((row) => row.capturedOn === '2026-10-01')
    expect(october.find((row) => row.ownerId !== null)).toMatchObject({ segment: 'good', recentApartments: 12 })
    expect(october.find((row) => row.ownerId === null)).toMatchObject({ segment: 'bad', missingApartments: 8 })
  })
})
