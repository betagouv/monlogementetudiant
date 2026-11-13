import { hashPassword } from 'better-auth/crypto'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { account, user } from '~/server/db/schema/auth'
import { auth } from '~/services/better-auth'
import { createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { ownerCaller } from './helpers/test-caller'

const PASSWORD = 'correctPassword123!'
const OLD_EMAIL = 'ancienne-adresse@afev.org'
const NEW_EMAIL = 'nouvelle-adresse@afev.org'

beforeEach(async () => {
  const db = getTestDb()

  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
  const owner = await createOwner({ name: 'Bailleur A', slug: 'bailleur-a', userId: 'test-owner-id' })
  await db.update(user).set({ bailleurRole: 'administrator', ownerId: owner.id }).where(eq(user.id, 'test-owner-id'))

  // Le gestionnaire dont l'administratrice va changer l'email : compte verifie + mot de passe.
  await createUser({ id: 'gest-email-change', name: 'Gest Email', email: OLD_EMAIL, role: 'owner', emailVerified: true })
  await db.update(user).set({ bailleurRole: 'gestionnaire', ownerId: owner.id }).where(eq(user.id, 'gest-email-change'))
  await db.insert(account).values({
    id: 'account-gest-email-change',
    userId: 'gest-email-change',
    accountId: 'gest-email-change',
    providerId: 'credential',
    password: await hashPassword(PASSWORD),
  })
})

describe("changement d'email par un administrateur bailleur", () => {
  it('permet a l utilisateur de se connecter avec sa nouvelle adresse', async () => {
    await ownerCaller.bailleur.users.update({ id: 'gest-email-change', email: NEW_EMAIL })

    const result = await auth.api.signInEmail({
      body: { email: NEW_EMAIL, password: PASSWORD },
      headers: new Headers(),
    })

    expect(result.user?.email).toBe(NEW_EMAIL)
    expect(result.token).toBeTruthy()
  })

  it('refuse la connexion avec l ancienne adresse', async () => {
    await ownerCaller.bailleur.users.update({ id: 'gest-email-change', email: NEW_EMAIL })

    await expect(
      auth.api.signInEmail({
        body: { email: OLD_EMAIL, password: PASSWORD },
        headers: new Headers(),
      }),
    ).rejects.toMatchObject({ body: { code: 'INVALID_EMAIL_OR_PASSWORD' } })
  })

  it("conserve le statut de verification d'email pour ne pas bloquer la connexion", async () => {
    await ownerCaller.bailleur.users.update({ id: 'gest-email-change', email: NEW_EMAIL })

    const db = getTestDb()
    const updated = await db.query.user.findFirst({ where: eq(user.id, 'gest-email-change') })
    expect(updated?.emailVerified).toBe(true)
  })

  it("conserve le compte credential (accountId indexe sur l'id utilisateur, pas sur l'email)", async () => {
    await ownerCaller.bailleur.users.update({ id: 'gest-email-change', email: NEW_EMAIL })

    const db = getTestDb()
    const credential = await db.query.account.findFirst({ where: eq(account.userId, 'gest-email-change') })
    expect(credential?.accountId).toBe('gest-email-change')
    expect(credential?.password).toBeTruthy()
  })
})
