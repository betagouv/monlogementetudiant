import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hashPassword } from 'better-auth/crypto'
import { createLocalAccountIssuer } from 'better-auth/db'
import { and, eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { account, session } from '~/server/db/schema/auth'
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
  sendMagicLinkEmail: vi.fn(async (email: string, url: string) => {
    sentEmails.push({ email, url })
  }),
}))

import { GET } from '~/app/api/auth/[...all]/route'
import { sendMagicLink } from '~/components/magic-link-sign-in/actions'
import { auth } from '~/services/better-auth'

const runMigrationFile = (file: string) =>
  getTestDb().transaction(async (tx) => {
    for (const statement of readFileSync(join(process.cwd(), 'drizzle', file), 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) await tx.execute(sql.raw(statement))
    }
  })

const runMigration = () => runMigrationFile('0070_remove_django_credentials.sql')
const runNonStudentPurge = () => runMigrationFile('0071_drop_non_student_passwords.sql')

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

describe('migration 0071 — mots de passe des rôles qui se connectent par lien', () => {
  const DASHBOARD_BY_ROLE = { owner: '/bailleur/tableau-de-bord', admin: '/administration/tableau-de-bord' } as const

  it.each(['owner', 'admin'] as const)('supprime le mot de passe créé dans l’application pour le rôle %s', async (role) => {
    const id = `${role}-applicatif`
    await seedAccount({ id, role, password: await hashPassword('motDePasseApplicatif123!'), accountId: id, legacy: false })
    // `0070` ne visait que les `account_id` hérités : cette ligne y survit.
    await runMigration()
    expect(await credentialsOf(id)).toHaveLength(1)

    await runNonStudentPurge()

    expect(await credentialsOf(id)).toHaveLength(0)
  })

  it.each(['owner', 'admin'] as const)('laisse le %s se connecter par lien une fois son mot de passe supprimé', async (role) => {
    const id = `${role}-lien`
    const email = await seedAccount({ id, role, password: await hashPassword('motDePasseSupprime123!'), accountId: id, legacy: false })

    await runNonStudentPurge()
    expect(await credentialsOf(id)).toHaveLength(0)

    await sendMagicLink(email, role, DASHBOARD_BY_ROLE[role])
    const verifyUrl = new URL(new URL(sentEmails.at(-1)!.url).searchParams.get('url')!)
    const response = await GET(new Request(verifyUrl.toString()))

    expect(new URL(response.headers.get('location')!, 'http://localhost').searchParams.get('error')).toBeNull()
    expect(await getTestDb().select().from(session).where(eq(session.userId, id))).toHaveLength(1)
    // La purge est définitive : se connecter par lien ne réécrit aucune ligne `account`.
    expect(await getTestDb().select().from(account).where(eq(account.userId, id))).toHaveLength(0)
  })

  it('ne touche pas au mot de passe des étudiants', async () => {
    const email = await seedAccount({
      id: 'etudiant-conserve',
      password: await hashPassword('motDePasseEtudiant123!'),
      accountId: 'etudiant-conserve',
      legacy: false,
    })

    await runNonStudentPurge()

    expect(await credentialsOf('etudiant-conserve')).toHaveLength(1)
    await expect(signIn(email, 'motDePasseEtudiant123!')).resolves.toMatchObject({ user: { email } })
  })

  it('est rejouable sans effet', async () => {
    await seedAccount({
      id: 'owner-rejeu',
      role: 'owner',
      password: await hashPassword('motDePasseRejeu123!'),
      accountId: 'owner-rejeu',
      legacy: false,
    })

    await runNonStudentPurge()
    await runNonStudentPurge()

    expect(await credentialsOf('owner-rejeu')).toHaveLength(0)
  })
})
