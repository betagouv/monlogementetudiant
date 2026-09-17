import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hashPassword } from 'better-auth/crypto'
import { createLocalAccountIssuer } from 'better-auth/db'
import { and, eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { account } from '~/server/db/schema/auth'
import { createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { getTestDb } from './helpers/test-db'

vi.mock('next/headers', () => ({ headers: () => new Headers() }))

const sentEmails = vi.hoisted(() => [] as { email: string; url: string }[])

vi.mock('~/server/services/brevo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/server/services/brevo')>()),
  sendResetPasswordEmail: vi.fn(async (email: string, url: string) => {
    sentEmails.push({ email, url })
  }),
}))

import { auth } from '~/services/better-auth'

const MIGRATION_PATH = join(process.cwd(), 'drizzle', '0070_remove_django_credentials.sql')

const runMigration = () =>
  getTestDb().transaction(async (tx) => {
    for (const statement of readFileSync(MIGRATION_PATH, 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) await tx.execute(sql.raw(statement))
    }
  })

const DJANGO_HASH = 'pbkdf2_sha256$600000$sel$aGFzaGRqYW5nb2RlbW8='

const seedAccount = async (params: {
  id: string
  role?: 'user' | 'owner' | 'admin'
  password: string
  accountId?: string
  legacy?: boolean
}) => {
  const email = `${params.id}@test.com`
  await createUser({ id: params.id, email, role: params.role ?? 'user', legacyUser: params.legacy ?? true })
  await getTestDb()
    .insert(account)
    .values({
      id: `account-${params.id}-${params.accountId ?? 'legacy'}`,
      userId: params.id,
      accountId: params.accountId ?? email,
      issuer: createLocalAccountIssuer('credential'),
      providerId: 'credential',
      password: params.password,
    })
  return email
}

const credentialsOf = (userId: string) =>
  getTestDb()
    .select()
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))

const signIn = (email: string, password: string) => auth.api.signInEmail({ body: { email, password }, headers: new Headers() })

beforeEach(() => {
  sentEmails.length = 0
})

describe('migration 0070 — comptes à mot de passe importés de Django', () => {
  it('supprime le mot de passe encore au format Django ; « mot de passe oublié » rétablit la connexion', async () => {
    const email = await seedAccount({ id: 'etudiant-django', password: DJANGO_HASH })

    await runMigration()

    expect(await credentialsOf('etudiant-django')).toHaveLength(0)
    await expect(signIn(email, 'nimporteQuoi123!')).rejects.toMatchObject({ body: { code: 'INVALID_EMAIL_OR_PASSWORD' } })

    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/se-connecter' }, headers: new Headers() })
    const token = new URL(sentEmails[0]!.url).pathname.split('/').pop()!
    await auth.api.resetPassword({ body: { token, newPassword: 'nouveauMotDePasse123!' }, headers: new Headers() })

    await expect(signIn(email, 'nouveauMotDePasse123!')).resolves.toMatchObject({ user: { email } })
  })

  it('conserve le mot de passe déjà réécrit en scrypt et le rend utilisable', async () => {
    const email = await seedAccount({ id: 'etudiant-scrypt', password: await hashPassword('motDePasseConnu123!') })
    await expect(signIn(email, 'motDePasseConnu123!')).rejects.toBeDefined()

    await runMigration()

    const [row] = await credentialsOf('etudiant-scrypt')
    expect(row!.accountId).toBe('etudiant-scrypt')
    await expect(signIn(email, 'motDePasseConnu123!')).resolves.toMatchObject({ user: { email } })
  })

  it('supprime la ligne importée quand le compte a déjà un mot de passe à jour', async () => {
    const email = await seedAccount({ id: 'etudiant-double', password: await hashPassword('ancienMotDePasse123!') })
    await getTestDb()
      .insert(account)
      .values({
        id: 'account-etudiant-double-current',
        userId: 'etudiant-double',
        accountId: 'etudiant-double',
        issuer: createLocalAccountIssuer('credential'),
        providerId: 'credential',
        password: await hashPassword('motDePasseActuel123!'),
      })

    await runMigration()

    const rows = await credentialsOf('etudiant-double')
    expect(rows.map((row) => row.id)).toEqual(['account-etudiant-double-current'])
    await expect(signIn(email, 'motDePasseActuel123!')).resolves.toMatchObject({ user: { email } })
  })

  it.each([
    ['owner', 'django'],
    ['owner', 'scrypt'],
    ['admin', 'scrypt'],
  ] as const)('supprime tout mot de passe importé pour le rôle %s (%s)', async (role, kind) => {
    const id = `${role}-${kind}`
    await seedAccount({ id, role, password: kind === 'scrypt' ? await hashPassword('motDePasseBailleur123!') : DJANGO_HASH })

    await runMigration()

    expect(await credentialsOf(id)).toHaveLength(0)
  })

  it('ne touche pas un compte créé directement sur la plateforme', async () => {
    const password = await hashPassword('motDePasseRecent123!')
    const email = await seedAccount({ id: 'etudiant-recent', password, accountId: 'etudiant-recent', legacy: false })

    await runMigration()

    const [row] = await credentialsOf('etudiant-recent')
    expect(row!.password).toBe(password)
    await expect(signIn(email, 'motDePasseRecent123!')).resolves.toMatchObject({ user: { email } })
  })

  it('est rejouable sans effet', async () => {
    const email = await seedAccount({ id: 'etudiant-rejeu', password: await hashPassword('motDePasseRejeu123!') })

    await runMigration()
    await runMigration()

    expect(await credentialsOf('etudiant-rejeu')).toHaveLength(1)
    await expect(signIn(email, 'motDePasseRejeu123!')).resolves.toMatchObject({ user: { email } })
  })
})
