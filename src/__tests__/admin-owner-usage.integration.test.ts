import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { ELoginAttemptStatus } from '~/enums/login-attempt-status'
import { session, user } from '~/server/db/schema/auth'
import { loginAttempts } from '~/server/db/schema/login-attempts'
import { createOwner, createUser } from './fixtures/factories'
import { adminCaller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'

const range = { from: '2026-09-16', to: '2026-09-17' }
const connectedAt = new Date('2026-09-16T10:00:00Z')

async function createAttempt(ownerId: number, overrides: Partial<typeof loginAttempts.$inferInsert> = {}) {
  return getTestDb()
    .insert(loginAttempts)
    .values({
      ownerId,
      userId: 'gestionnaire-id',
      email: 'gestionnaire@test.com',
      role: 'owner',
      tokenHash: crypto.randomUUID(),
      createdAt: new Date(connectedAt.getTime() - 60_000),
      expiresAt: new Date(connectedAt.getTime() + 540_000),
      status: ELoginAttemptStatus.COMPLETED,
      verifiedAt: connectedAt,
      ...overrides,
    })
}

beforeEach(async () => {
  await createUser({ id: 'test-admin-id', role: 'admin' })
  await createUser({ id: 'gestionnaire-id', email: 'gestionnaire@test.com', role: 'owner' })
})

describe('admin.ownerUsage — historique des connexions', () => {
  it('conserve le compteur, la dernière connexion et le graphique après suppression de la session', async () => {
    const db = getTestDb()
    const owner = await createOwner({ userId: 'gestionnaire-id' })
    await createAttempt(owner.id)
    await db.insert(session).values({
      id: 'session-gestionnaire',
      token: 'session-token',
      userId: 'gestionnaire-id',
      createdAt: connectedAt,
      expiresAt: new Date('2026-09-17T10:00:00Z'),
    })

    const before = await adminCaller.admin.ownerUsage.list(range)
    expect(before[0].nbLogins).toBe(1)

    await db.delete(session).where(eq(session.id, 'session-gestionnaire'))

    const after = await adminCaller.admin.ownerUsage.list(range)
    const detail = await adminCaller.admin.ownerUsage.detail({ ...range, ownerId: owner.id })
    expect(after[0].nbLogins).toBe(1)
    expect(new Date(after[0].lastLogin!).toISOString()).toBe(connectedAt.toISOString())
    expect(detail.loginsByDay).toEqual([{ date: '2026-09-16', count: 1 }])
  })

  it('compte uniquement les succès non admin du bailleur, à la date de vérification dans la période', async () => {
    const owner = await createOwner({ userId: 'gestionnaire-id' })
    const otherOwner = await createOwner({ slug: 'autre-bailleur' })
    await createAttempt(owner.id, {
      createdAt: new Date('2026-09-15T23:59:00Z'),
      verifiedAt: new Date('2026-09-16T00:00:00Z'),
    })
    await createAttempt(owner.id, { verifiedAt: new Date('2026-09-17T23:59:59Z') })
    await createAttempt(owner.id, { verifiedAt: new Date('2026-09-15T23:59:59Z') })
    await createAttempt(owner.id, { verifiedAt: new Date('2026-09-18T00:00:00Z') })
    await createAttempt(owner.id, { role: 'admin', verifiedAt: new Date('2026-09-19T10:00:00Z') })
    await createAttempt(owner.id, { role: 'admin' })
    await createAttempt(owner.id, { status: ELoginAttemptStatus.EMAIL_SENT, verifiedAt: null })
    await createAttempt(owner.id, { status: ELoginAttemptStatus.EXPIRED })
    await createAttempt(owner.id, { status: ELoginAttemptStatus.INVALID })
    await createAttempt(otherOwner.id)

    const rows = await adminCaller.admin.ownerUsage.list(range)
    const row = rows.find((item) => item.id === owner.id)!
    const detail = await adminCaller.admin.ownerUsage.detail({ ...range, ownerId: owner.id })
    expect(row.nbLogins).toBe(2)
    // La dernière connexion reste calculée sur tout l'historique disponible.
    expect(new Date(row.lastLogin!).toISOString()).toBe('2026-09-18T00:00:00.000Z')
    expect(detail.loginsByDay).toEqual([
      { date: '2026-09-16', count: 1 },
      { date: '2026-09-17', count: 1 },
    ])
  })

  it('conserve le rattachement historique après changement de rôle, de bailleur et suppression du compte', async () => {
    const db = getTestDb()
    const owner = await createOwner({ userId: 'gestionnaire-id' })
    const otherOwner = await createOwner({ slug: 'autre-bailleur' })
    await createAttempt(owner.id)
    await db.update(user).set({ role: 'admin', ownerId: otherOwner.id }).where(eq(user.id, 'gestionnaire-id'))

    for (const deleteAccount of [false, true]) {
      if (deleteAccount) await db.delete(user).where(eq(user.id, 'gestionnaire-id'))
      const rows = await adminCaller.admin.ownerUsage.list(range)
      expect(rows.find((row) => row.id === owner.id)?.nbLogins).toBe(1)
      expect(rows.find((row) => row.id === otherOwner.id)).toMatchObject({ nbLogins: 0, lastLogin: null })
      const detail = await adminCaller.admin.ownerUsage.detail({ ...range, ownerId: owner.id })
      expect(detail.loginsByDay).toEqual([{ date: '2026-09-16', count: 1 }])
    }
  })
})
