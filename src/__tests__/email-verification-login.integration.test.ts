import { hashPassword } from 'better-auth/crypto'
import { describe, expect, it } from 'vitest'
import { account } from '~/server/db/schema/auth'
import { auth } from '~/services/better-auth'
import { createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

async function createCredentialUser(overrides: { id: string; email: string; emailVerified: boolean; password: string }) {
  const db = getTestDb()
  await createUser({
    id: overrides.id,
    email: overrides.email,
    emailVerified: overrides.emailVerified,
    role: 'user',
  })
  const hash = await hashPassword(overrides.password)
  await db.insert(account).values({
    id: `account-${overrides.id}`,
    userId: overrides.id,
    accountId: overrides.id,
    providerId: 'credential',
    password: hash,
  })
}

describe('email verification gate on credentials sign-in', () => {
  it('blocks sign-in with EMAIL_NOT_VERIFIED when emailVerified is false', async () => {
    const email = 'unverified-student@test.com'
    const password = 'correctPassword123!'
    await createCredentialUser({ id: 'unverified-student', email, emailVerified: false, password })

    await expect(
      auth.api.signInEmail({
        body: { email, password },
        headers: new Headers(),
      }),
    ).rejects.toMatchObject({
      status: 'FORBIDDEN',
      body: { code: 'EMAIL_NOT_VERIFIED' },
    })
  })

  it('allows sign-in when emailVerified is true', async () => {
    const email = 'verified-student@test.com'
    const password = 'correctPassword123!'
    await createCredentialUser({ id: 'verified-student', email, emailVerified: true, password })

    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: new Headers(),
    })

    expect(result.user?.email).toBe(email)
    expect(result.token).toBeTruthy()
  })

  it('returns INVALID_EMAIL_OR_PASSWORD (not EMAIL_NOT_VERIFIED) for an unverified user with a wrong password', async () => {
    // Important : la vérif d'email se fait *après* le check du mot de passe.
    // Sinon, on leakerait l'existence d'un compte non vérifié à un attaquant.
    const email = 'unverified-wrong-pwd@test.com'
    await createCredentialUser({ id: 'unverified-wrong-pwd', email, emailVerified: false, password: 'rightPassword123!' })

    await expect(
      auth.api.signInEmail({
        body: { email, password: 'wrongPassword123!' },
        headers: new Headers(),
      }),
    ).rejects.toMatchObject({
      status: 'UNAUTHORIZED',
      body: { code: 'INVALID_EMAIL_OR_PASSWORD' },
    })
  })
})
