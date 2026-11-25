import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { user } from '~/server/db/schema'
import { purgeInactiveAccounts } from '~/server/users/purge-inactive'
import { createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { getTestDb } from './helpers/test-db'

const mockedEnv = vi.hoisted(() => ({}) as Record<string, unknown>)
vi.mock('~/server/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/server/env')>()
  Object.assign(mockedEnv, actual.env, { NEXT_PUBLIC_APP_ENV: 'production' })
  return { env: mockedEnv }
})

const deleteBrevoContact = vi.hoisted(() => vi.fn())
vi.mock('~/server/services/brevo', async () => {
  const actual = await vi.importActual<typeof import('~/server/services/brevo')>('~/server/services/brevo')
  return { ...actual, deleteBrevoContact: (...args: unknown[]) => deleteBrevoContact(...args) }
})

const ageLastActivity = (id: string, months: number) =>
  getTestDb()
    .update(user)
    .set({ lastActiveAt: sql`now() - ${`${months} months`}::interval` })
    .where(eq(user.id, id))

beforeEach(() => {
  deleteBrevoContact.mockClear()
  deleteBrevoContact.mockResolvedValue(undefined)
  mockedEnv.NEXT_PUBLIC_APP_ENV = 'production'
})

describe('purgeInactiveAccounts', () => {
  it('supprime les comptes étudiants inactifs depuis plus de 24 mois, Brevo compris', async () => {
    const db = getTestDb()
    await createUser({ id: 'dormant-student', email: 'dormant@test.com', role: 'user' })
    await ageLastActivity('dormant-student', 25)

    const result = await purgeInactiveAccounts()

    expect(result.purged).toBe(1)
    expect(await db.query.user.findFirst({ where: eq(user.id, 'dormant-student') })).toBeUndefined()
    expect(deleteBrevoContact).toHaveBeenCalledWith('dormant@test.com')
  })

  it('épargne les comptes encore dans la fenêtre de 24 mois', async () => {
    const db = getTestDb()
    await createUser({ id: 'recent-student', email: 'recent@test.com', role: 'user' })
    await ageLastActivity('recent-student', 23)

    const result = await purgeInactiveAccounts()

    expect(result.purged).toBe(0)
    expect(await db.query.user.findFirst({ where: eq(user.id, 'recent-student') })).toBeDefined()
  })

  it('épargne les comptes gestionnaires et admins, quelle que soit leur inactivité', async () => {
    const db = getTestDb()
    await createUser({ id: 'dormant-owner', email: 'dormant-owner@test.com', role: 'owner' })
    await createUser({ id: 'dormant-admin', email: 'dormant-admin@test.com', role: 'admin' })
    await ageLastActivity('dormant-owner', 36)
    await ageLastActivity('dormant-admin', 36)

    const result = await purgeInactiveAccounts()

    expect(result.purged).toBe(0)
    expect(await db.query.user.findFirst({ where: eq(user.id, 'dormant-owner') })).toBeDefined()
    expect(await db.query.user.findFirst({ where: eq(user.id, 'dormant-admin') })).toBeDefined()
  })

  it('compte sans rien supprimer en dry-run', async () => {
    const db = getTestDb()
    await createUser({ id: 'dormant-dry-run', email: 'dry-run@test.com', role: 'user' })
    await ageLastActivity('dormant-dry-run', 30)

    const result = await purgeInactiveAccounts({ dryRun: true })

    expect(result.purged).toBe(1)
    expect(await db.query.user.findFirst({ where: eq(user.id, 'dormant-dry-run') })).toBeDefined()
    expect(deleteBrevoContact).not.toHaveBeenCalled()
  })

  it('continue le lot quand une suppression Brevo échoue', async () => {
    const db = getTestDb()
    await createUser({ id: 'dormant-a', email: 'dormant-a@test.com', role: 'user' })
    await createUser({ id: 'dormant-b', email: 'dormant-b@test.com', role: 'user' })
    await ageLastActivity('dormant-a', 25)
    await ageLastActivity('dormant-b', 25)
    deleteBrevoContact.mockRejectedValueOnce(new Error('Brevo indisponible'))

    const result = await purgeInactiveAccounts()

    expect(result.purged).toBe(2)
    expect(await db.query.user.findFirst({ where: eq(user.id, 'dormant-a') })).toBeUndefined()
    expect(await db.query.user.findFirst({ where: eq(user.id, 'dormant-b') })).toBeUndefined()
  })
})
