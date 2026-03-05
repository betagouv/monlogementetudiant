import { hashPassword, verifyPassword as verifyScryptPassword } from 'better-auth/crypto'
import { pbkdf2Sync } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { verifyDjangoPassword } from '~/lib/django-password'
import { account } from '~/server/db/schema/auth'
import { createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

function makeDjangoHash(password: string, salt = 'testsalt', iterations = 260000): string {
  const derived = pbkdf2Sync(password, salt, iterations, 32, 'sha256')
  return `pbkdf2_sha256$${iterations}$${salt}$${derived.toString('base64')}`
}

async function createAccountWithHash(userId: string, hash: string) {
  const db = getTestDb()
  await db.insert(account).values({
    id: `account-${userId}`,
    userId,
    accountId: userId,
    providerId: 'credential',
    password: hash,
  })
}

async function getAccountPassword(userId: string) {
  const db = getTestDb()
  const [row] = await db
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
  return row?.password ?? null
}

// Reproduce the verify logic from better-auth.ts
async function verifyAndRehash(hash: string, password: string): Promise<boolean> {
  const db = getTestDb()
  const scryptMatch = await verifyScryptPassword({ hash, password }).catch(() => false)
  if (scryptMatch) return true

  if (hash.startsWith('pbkdf2_sha256$')) {
    const djangoMatch = verifyDjangoPassword(password, hash)
    if (djangoMatch) {
      const newHash = await hashPassword(password)
      await db
        .update(account)
        .set({ password: newHash })
        .where(and(eq(account.password, hash), eq(account.providerId, 'credential')))
      return true
    }
  }

  return false
}

describe('password verify flow', () => {
  it('verifies a scrypt hash directly', async () => {
    const password = 'mySecurePassword123!'
    const hash = await hashPassword(password)
    const userId = 'test-scrypt-user'

    await createUser({ id: userId })
    await createAccountWithHash(userId, hash)

    const result = await verifyAndRehash(hash, password)
    expect(result).toBe(true)

    // Hash should remain unchanged (no rehash needed)
    const storedHash = await getAccountPassword(userId)
    expect(storedHash).toBe(hash)
  })

  it('verifies a Django PBKDF2 hash and rehashes to scrypt', async () => {
    const password = 'djangoPassword456!'
    const djangoHash = makeDjangoHash(password)
    const userId = 'test-django-user'

    await createUser({ id: userId })
    await createAccountWithHash(userId, djangoHash)

    const result = await verifyAndRehash(djangoHash, password)
    expect(result).toBe(true)

    // Hash should now be rehashed to scrypt
    const storedHash = await getAccountPassword(userId)
    expect(storedHash).not.toBe(djangoHash)
    expect(storedHash).not.toContain('pbkdf2_sha256$')

    // New scrypt hash should verify correctly
    const scryptResult = await verifyScryptPassword({ hash: storedHash!, password })
    expect(scryptResult).toBe(true)
  })

  it('after rehash, login works with scrypt directly', async () => {
    const password = 'rehashTest789!'
    const djangoHash = makeDjangoHash(password)
    const userId = 'test-rehash-user'

    await createUser({ id: userId })
    await createAccountWithHash(userId, djangoHash)

    // First login: Django hash → rehash to scrypt
    await verifyAndRehash(djangoHash, password)

    // Get the new scrypt hash
    const newHash = await getAccountPassword(userId)
    expect(newHash).toBeTruthy()
    expect(newHash).not.toContain('pbkdf2_sha256$')

    // Second login: should work via scrypt directly
    const result = await verifyAndRehash(newHash!, password)
    expect(result).toBe(true)
  })

  it('rejects wrong password for Django hash', async () => {
    const djangoHash = makeDjangoHash('correctPassword!')
    const result = await verifyAndRehash(djangoHash, 'wrongPassword!')
    expect(result).toBe(false)
  })

  it('rejects wrong password for scrypt hash', async () => {
    const hash = await hashPassword('correctPassword!')
    const result = await verifyAndRehash(hash, 'wrongPassword!')
    expect(result).toBe(false)
  })
})
