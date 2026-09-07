import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { and, eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { activityLog } from '~/server/db/schema/activity-log'
import { typologyDraft } from '~/server/lib/typologies'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const MIGRATION_PATH = join(process.cwd(), 'drizzle', '0058_typology_availability_tracking.sql')

/**
 * Rejoue l'instruction de reprise livrée dans la migration.
 *
 * La base de test est vierge quand les migrations s'appliquent : sans ce rejeu sur des données
 * semées, le SQL de reprise partirait en production sans avoir jamais rien mis à jour.
 */
const BACKFILL_SQL = readFileSync(MIGRATION_PATH, 'utf8').split('--> statement-breakpoint').at(-1) as string

const runBackfill = () => getTestDb().execute(sql.raw(BACKFILL_SQL))

const readTypology = async (accommodationId: number, type: 't1' | 't1_bis' | 't2') => {
  const [row] = await getTestDb()
    .select()
    .from(accommodationTypologies)
    .where(and(eq(accommodationTypologies.accommodationId, accommodationId), eq(accommodationTypologies.type, type)))
    .limit(1)
  return row ?? null
}

/** Remet les colonnes à leur état d'avant reprise : les fixtures les renseignent à l'écriture. */
const clearTimestamps = () => getTestDb().update(accommodationTypologies).set({ availabilityUpdatedAt: null, availabilityUpdatedBy: null })

const logAvailabilityChange = (params: { slug: string; diff: Record<string, unknown>; userId?: string; createdAt: Date }) =>
  getTestDb()
    .insert(activityLog)
    .values({
      action: 'accommodation.availability_updated',
      entityType: 'accommodation',
      userId: params.userId ?? null,
      createdAt: params.createdAt,
      metadata: { slug: params.slug, diff: params.diff },
    })

let accommodationId: number

beforeEach(async () => {
  // `activity_log` survit à `cleanTables` alors que les slugs de résidence se répètent d'un test à
  // l'autre : sans purge, la reprise relirait les entrées semées par le test précédent.
  await getTestDb().delete(activityLog)
  await createUser({ id: 'gest-id', name: 'Gestionnaire', email: 'gest@test.com', role: 'owner' })
  const owner = await createOwner({ name: 'Bailleur Reprise', slug: 'bailleur-reprise', userId: 'gest-id' })
  const accommodation = await createAccommodation({ name: 'Résidence Reprise', slug: 'residence-reprise', ownerId: owner.id }, [
    typologyDraft('t1', { nbTotal: 10, nbAvailable: 2 }),
    typologyDraft('t1_bis', { nbTotal: 5, nbAvailable: 1 }),
    typologyDraft('t2', { nbTotal: 8, nbAvailable: 3 }),
  ])
  accommodationId = accommodation.id
  await clearTimestamps()
})

describe('migration 0058 — reprise des dates de mise à jour des disponibilités', () => {
  it('reprend la convention actuelle `typologies.<type>.nbAvailable`', async () => {
    const changedAt = new Date('2026-08-01T10:00:00Z')
    await logAvailabilityChange({
      slug: 'residence-reprise',
      diff: { 'typologies.t1.nbAvailable': { old: 5, new: 2 } },
      userId: 'gest-id',
      createdAt: changedAt,
    })

    await runBackfill()

    const t1 = await readTypology(accommodationId, 't1')
    expect(t1?.availabilityUpdatedAt).toEqual(changedAt)
    expect(t1?.availabilityUpdatedBy).toBe('gest-id')
  })

  it('reprend les anciennes colonnes plates sans confondre T1 et T1 bis', async () => {
    await logAvailabilityChange({
      slug: 'residence-reprise',
      diff: { nbT1Available: { old: 4, new: 2 } },
      userId: 'gest-id',
      createdAt: new Date('2026-06-01T10:00:00Z'),
    })
    await logAvailabilityChange({
      slug: 'residence-reprise',
      diff: { nbT1BisAvailable: { old: 3, new: 1 } },
      userId: 'gest-id',
      createdAt: new Date('2026-06-02T10:00:00Z'),
    })

    await runBackfill()

    expect((await readTypology(accommodationId, 't1'))?.availabilityUpdatedAt).toEqual(new Date('2026-06-01T10:00:00Z'))
    expect((await readTypology(accommodationId, 't1_bis'))?.availabilityUpdatedAt).toEqual(new Date('2026-06-02T10:00:00Z'))
  })

  it('retient la modification la plus récente de chaque typologie', async () => {
    await logAvailabilityChange({
      slug: 'residence-reprise',
      diff: { 'typologies.t1.nbAvailable': { old: 9, new: 5 } },
      userId: 'gest-id',
      createdAt: new Date('2026-07-01T10:00:00Z'),
    })
    await logAvailabilityChange({
      slug: 'residence-reprise',
      diff: { 'typologies.t1.nbAvailable': { old: 5, new: 2 } },
      userId: 'gest-id',
      createdAt: new Date('2026-08-15T10:00:00Z'),
    })

    await runBackfill()

    expect((await readTypology(accommodationId, 't1'))?.availabilityUpdatedAt).toEqual(new Date('2026-08-15T10:00:00Z'))
  })

  it('ignore les modifications qui ne portent pas sur une disponibilité', async () => {
    await logAvailabilityChange({
      slug: 'residence-reprise',
      diff: { 'typologies.t1.priceMin': { old: 400, new: 450 }, name: { old: 'A', new: 'B' } },
      userId: 'gest-id',
      createdAt: new Date('2026-08-01T10:00:00Z'),
    })

    await runBackfill()

    expect((await readTypology(accommodationId, 't1'))?.availabilityUpdatedAt).toBeNull()
  })

  it('garde la date mais pas l’auteur quand le compte a disparu', async () => {
    const changedAt = new Date('2026-08-01T10:00:00Z')
    await logAvailabilityChange({
      slug: 'residence-reprise',
      diff: { 'typologies.t2.nbAvailable': { old: 7, new: 3 } },
      userId: 'compte-supprime',
      createdAt: changedAt,
    })

    await runBackfill()

    const t2 = await readTypology(accommodationId, 't2')
    expect(t2?.availabilityUpdatedAt).toEqual(changedAt)
    expect(t2?.availabilityUpdatedBy).toBeNull()
  })

  it('laisse intactes les typologies sans historique', async () => {
    await runBackfill()

    expect((await readTypology(accommodationId, 't1'))?.availabilityUpdatedAt).toBeNull()
    expect((await readTypology(accommodationId, 't2'))?.availabilityUpdatedAt).toBeNull()
  })

  it('ne date pas une typologie dont la disponibilité n’est pas renseignée', async () => {
    const db = getTestDb()
    await db.update(accommodationTypologies).set({ nbAvailable: null }).where(eq(accommodationTypologies.accommodationId, accommodationId))
    await logAvailabilityChange({
      slug: 'residence-reprise',
      diff: { 'typologies.t1.nbAvailable': { old: 5, new: null } },
      userId: 'gest-id',
      createdAt: new Date('2026-08-01T10:00:00Z'),
    })

    await runBackfill()

    expect((await readTypology(accommodationId, 't1'))?.availabilityUpdatedAt).toBeNull()
  })

  it('ne touche pas aux résidences d’un autre slug', async () => {
    const owner = await createOwner({ name: 'Autre Bailleur', slug: 'autre-bailleur' })
    const autre = await createAccommodation({ name: 'Autre Résidence', slug: 'autre-residence', ownerId: owner.id }, [
      typologyDraft('t1', { nbAvailable: 4 }),
    ])
    await clearTimestamps()
    await logAvailabilityChange({
      slug: 'residence-reprise',
      diff: { 'typologies.t1.nbAvailable': { old: 5, new: 2 } },
      userId: 'gest-id',
      createdAt: new Date('2026-08-01T10:00:00Z'),
    })

    await runBackfill()

    expect((await readTypology(autre.id, 't1'))?.availabilityUpdatedAt).toBeNull()
  })
})
