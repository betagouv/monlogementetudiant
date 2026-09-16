import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq, inArray, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { alertJobs } from '~/server/db/schema/alert-jobs'
import { user } from '~/server/db/schema/auth'
import { budgetSimulations } from '~/server/db/schema/budget-simulations'
import { favoriteAccommodations } from '~/server/db/schema/favorite-accommodations'
import { studentAlerts } from '~/server/db/schema/student-alerts'
import { createAccommodation, createAlert, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const MIGRATION_PATH = join(process.cwd(), 'drizzle', '0068_merge_case_duplicate_accounts.sql')

/**
 * Rejoue la migration sur des données semées, dans une transaction comme `drizzle-kit migrate` : la base
 * de test est vierge quand les migrations s'appliquent, la reprise n'y a donc jamais rien fusionné.
 */
const runMigration = () =>
  getTestDb().transaction(async (tx) => {
    for (const statement of readFileSync(MIGRATION_PATH, 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) await tx.execute(sql.raw(statement))
    }
  })

const emailOf = async (id: string) => (await getTestDb().query.user.findFirst({ where: eq(user.id, id) }))?.email ?? null

let acc1: number
let acc2: number

beforeEach(async () => {
  acc1 = (await createAccommodation({ slug: 'merge-acc-1' })).id
  acc2 = (await createAccommodation({ slug: 'merge-acc-2' })).id
})

describe('migration 0068 — comptes en doublon à la casse près', () => {
  const seedPair = async () => {
    const db = getTestDb()
    // Compte récent, celui qui se connecte (Better Auth cherche en minuscules).
    await createUser({ id: 'recent', email: 'alice@univ.fr', role: 'user', firstname: '', lastname: '' })
    await db.insert(favoriteAccommodations).values({ userId: 'recent', accommodationId: acc1 })
    await db.insert(alertJobs).values({ userId: 'recent', accommodationId: acc1, source: 'favorite', status: 'pending' })

    // Ancien compte Django, injoignable mais porteur de données.
    await createUser({
      id: 'legacy',
      email: 'Alice@Univ.fr',
      role: 'user',
      legacyUser: true,
      legacyId: 42,
      firstname: 'Alice',
      lastname: 'Martin',
      phone: '0601020304',
    })
    await db.insert(favoriteAccommodations).values([
      { userId: 'legacy', accommodationId: acc1 },
      { userId: 'legacy', accommodationId: acc2 },
    ])
    const alert = await createAlert({ userId: 'legacy', maxPrice: 600 })
    await db.insert(alertJobs).values([
      { userId: 'legacy', accommodationId: acc1, source: 'favorite', status: 'pending' },
      { userId: 'legacy', accommodationId: acc2, source: 'alert', studentAlertId: alert!.id, status: 'pending' },
    ])
    await db.insert(budgetSimulations).values({ userId: 'legacy', inputs: {} as never })
    return { alertId: alert!.id }
  }

  it("fusionne l'ancien compte dans le compte récent et supprime l'ancien", async () => {
    const { alertId } = await seedPair()

    await runMigration()

    const db = getTestDb()
    expect(await db.query.user.findFirst({ where: eq(user.id, 'legacy') })).toBeUndefined()

    const favorites = await db.select().from(favoriteAccommodations).where(eq(favoriteAccommodations.userId, 'recent'))
    expect(favorites.map((f) => f.accommodationId).sort()).toEqual([acc1, acc2].sort())

    const [alert] = await db.select().from(studentAlerts).where(eq(studentAlerts.id, alertId))
    expect(alert!.userId).toBe('recent')

    const jobs = await db.select().from(alertJobs).where(eq(alertJobs.userId, 'recent'))
    // Le job favori en doublon est abandonné, celui de l'alerte suit l'alerte.
    expect(jobs.map((j) => `${j.source}:${j.accommodationId}`).sort()).toEqual([`alert:${acc2}`, `favorite:${acc1}`].sort())

    expect(await db.select().from(budgetSimulations).where(eq(budgetSimulations.userId, 'recent'))).toHaveLength(1)

    const recent = await db.query.user.findFirst({ where: eq(user.id, 'recent') })
    expect(recent).toMatchObject({ email: 'alice@univ.fr', firstname: 'Alice', lastname: 'Martin', phone: '0601020304', legacyId: 42 })
  })

  it("ne touche pas une paire où l'un des comptes n'est pas étudiant", async () => {
    await createUser({ id: 'bailleur', email: 'Bob@Bailleur.fr', role: 'owner' })
    await createUser({ id: 'etudiant', email: 'bob@bailleur.fr', role: 'user' })

    await runMigration()

    expect(await emailOf('bailleur')).toBe('Bob@Bailleur.fr')
    expect(await emailOf('etudiant')).toBe('bob@bailleur.fr')
  })

  it('passe en minuscules une adresse sans doublon', async () => {
    await createUser({ id: 'solo', email: 'Solo@Univ.fr', role: 'user' })

    await runMigration()

    expect(await emailOf('solo')).toBe('solo@univ.fr')
  })

  it('est rejouable sans effet', async () => {
    await seedPair()
    await runMigration()
    await runMigration()

    const remaining = await getTestDb()
      .select({ id: user.id })
      .from(user)
      .where(inArray(user.id, ['recent', 'legacy']))
    expect(remaining.map((r) => r.id)).toEqual(['recent'])
  })
})
