import { hashPassword } from 'better-auth/crypto'
import { createLocalAccountIssuer } from 'better-auth/db'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { account, session, user, verification } from '~/server/db/schema/auth'
import { env } from '~/server/env'
import { createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { getTestDb } from './helpers/test-db'

vi.mock('next/headers', () => ({ headers: () => new Headers() }))

const sentEmails = vi.hoisted(() => [] as { email: string; url: string }[])

vi.mock('~/server/services/brevo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/server/services/brevo')>()),
  sendMagicLinkEmail: vi.fn(async (email: string, url: string) => {
    sentEmails.push({ email, url })
  }),
  sendResetPasswordEmail: vi.fn(async (email: string, url: string) => {
    sentEmails.push({ email, url })
  }),
}))

import { GET } from '~/app/api/auth/[...all]/route'
import { sendMagicLink } from '~/components/magic-link-sign-in/actions'
import { auth } from '~/services/better-auth'

/** URL de vérification Better Auth encapsulée dans la page tampon envoyée par e-mail. */
const verifyUrlFromEmail = (bufferUrl: string) => new URL(new URL(bufferUrl).searchParams.get('url')!)

beforeEach(() => {
  sentEmails.length = 0
})

describe('lien de connexion', () => {
  it('ne stocke pas le jeton en clair, et le lien reste utilisable', async () => {
    await createUser({ id: 'gest-hash', name: 'Gestionnaire', email: 'gest-hash@bailleur.fr', role: 'owner' })

    await sendMagicLink('gest-hash@bailleur.fr', 'owner', '/bailleur/tableau-de-bord')
    const verifyUrl = verifyUrlFromEmail(sentEmails[0]!.url)
    const token = verifyUrl.searchParams.get('token')!

    const rows = await getTestDb().select({ identifier: verification.identifier }).from(verification)
    expect(rows.map((row) => row.identifier)).not.toContain(token)

    const response = await GET(new Request(verifyUrl.toString()))
    const location = new URL(response.headers.get('location')!, 'http://localhost')
    expect(location.searchParams.get('error')).toBeNull()
  })

  it('retrouve le compte quelle que soit la casse saisie', async () => {
    await createUser({ id: 'gest-casse', name: 'Gestionnaire', email: 'gest-casse@bailleur.fr', role: 'owner' })

    await sendMagicLink('  Gest-Casse@Bailleur.FR ', 'owner', '/bailleur/tableau-de-bord')

    expect(sentEmails.map((sent) => sent.email)).toEqual(['gest-casse@bailleur.fr'])
  })

  it("n'envoie aucun lien à un rôle inattendu", async () => {
    await createUser({ id: 'role-inconnu', name: 'Inconnu', email: 'inconnu@bailleur.fr', role: 'moderator' })

    await auth.api.signInMagicLink({
      body: { email: 'inconnu@bailleur.fr', callbackURL: '/bailleur/tableau-de-bord' },
      headers: new Headers(),
    })

    expect(sentEmails).toHaveLength(0)
  })

  it("ne crée pas de compte quand l'adresse du lien ne correspond plus à aucun utilisateur", async () => {
    await createUser({ id: 'gest-gone', name: 'Gestionnaire', email: 'gest-gone@bailleur.fr', role: 'owner' })
    await sendMagicLink('gest-gone@bailleur.fr', 'owner', '/bailleur/tableau-de-bord')
    const verifyUrl = verifyUrlFromEmail(sentEmails[0]!.url)
    await getTestDb().delete(user).where(eq(user.id, 'gest-gone'))

    await GET(new Request(verifyUrl.toString()))

    const recreated = await getTestDb().select().from(user).where(eq(user.email, 'gest-gone@bailleur.fr'))
    expect(recreated).toHaveLength(0)
  })
})

describe('réinitialisation du mot de passe', () => {
  it('ne stocke pas le jeton de réinitialisation en clair', async () => {
    const email = 'etudiant-jeton@test.com'
    await createUser({ id: 'etudiant-jeton', email, emailVerified: true, role: 'user' })

    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/se-connecter' }, headers: new Headers() })
    const token = new URL(sentEmails[0]!.url).pathname.split('/').pop()!

    const rows = await getTestDb().select({ identifier: verification.identifier }).from(verification)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.identifier).not.toContain(token)
  })

  it.each(['owner', 'admin'] as const)("n'envoie aucun lien de réinitialisation au rôle %s, qui se connecte par lien", async (role) => {
    const email = `${role}-reset@test.com`
    await createUser({ id: `${role}-reset`, email, emailVerified: true, role })

    const result = await auth.api.requestPasswordReset({ body: { email, redirectTo: '/se-connecter' }, headers: new Headers() })

    // Réponse identique à celle d'un compte inconnu.
    expect(result.status).toBe(true)
    expect(sentEmails).toHaveLength(0)
  })

  it('révoque les sessions ouvertes', async () => {
    const email = 'etudiant-reset@test.com'
    const password = 'ancienMotDePasse123!'
    await createUser({ id: 'etudiant-reset', email, emailVerified: true, role: 'user' })
    await getTestDb()
      .insert(account)
      .values({
        id: 'account-etudiant-reset',
        userId: 'etudiant-reset',
        accountId: 'etudiant-reset',
        issuer: createLocalAccountIssuer('credential'),
        providerId: 'credential',
        password: await hashPassword(password),
      })
    await auth.api.signInEmail({ body: { email, password }, headers: new Headers() })
    expect(await getTestDb().select().from(session).where(eq(session.userId, 'etudiant-reset'))).toHaveLength(1)

    await auth.api.requestPasswordReset({ body: { email, redirectTo: '/se-connecter' }, headers: new Headers() })
    const token = new URL(sentEmails[0]!.url).pathname.split('/').pop()!
    await auth.api.resetPassword({ body: { token, newPassword: 'nouveauMotDePasse123!' }, headers: new Headers() })

    expect(await getTestDb().select().from(session).where(eq(session.userId, 'etudiant-reset'))).toHaveLength(0)
  })
})

describe('routes HTTP Better Auth inutilisées', () => {
  const call = (path: string, method = 'POST') =>
    auth.handler(
      new Request(`${env.BASE_URL}/api/auth${path}`, {
        method,
        headers: { 'content-type': 'application/json', origin: env.BASE_URL },
        body: method === 'POST' ? '{}' : undefined,
      }),
    )

  it.each([
    '/admin/set-user-password',
    '/admin/update-user',
    '/admin/set-role',
    '/admin/create-user',
    '/admin/remove-user',
    '/admin/ban-user',
    '/admin/unban-user',
    '/admin/revoke-user-session',
    '/admin/revoke-user-sessions',
    '/admin/has-permission',
    '/verify-password',
  ])('%s répond 404', async (path) => {
    expect((await call(path)).status).toBe(404)
  })

  it.each(['/admin/list-users', '/admin/get-user', '/admin/list-user-sessions'])('%s (GET/POST) répond 404', async (path) => {
    expect((await call(path, 'GET')).status).toBe(404)
    expect((await call(path)).status).toBe(404)
  })

  it("garde l'impersonation, utilisée par le back-office", async () => {
    expect((await call('/admin/impersonate-user')).status).not.toBe(404)
    expect((await call('/admin/stop-impersonating')).status).not.toBe(404)
  })
})
