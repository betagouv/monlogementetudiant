import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ELoginAttemptStatus } from '~/enums/login-attempt-status'
import { session } from '~/server/db/schema/auth'
import { loginAttempts } from '~/server/db/schema/login-attempts'
import { createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { testCookies } from './helpers/test-cookies'
import { getTestDb } from './helpers/test-db'

vi.mock('next/headers', async () => {
  const { testCookies } = await import('./helpers/test-cookies')
  return { headers: () => new Headers(), cookies: async () => testCookies }
})

const sentEmails = vi.hoisted(() => [] as { email: string; url: string; otp?: string }[])

vi.mock('~/server/services/brevo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/server/services/brevo')>()),
  sendMagicLinkEmail: vi.fn(async (email: string, url: string, otp?: string) => {
    sentEmails.push({ email, url, otp })
  }),
}))

import { GET, POST } from '~/app/api/auth/[...all]/route'
import { sendMagicLink } from '~/components/magic-link-sign-in/actions'
import { recoverLoginWithBinding } from '~/components/otp-sign-in/actions'
import { recordMagicLinkSent } from '~/server/services/login-attempts'
import { LOGIN_BINDING_COOKIE } from '~/server/services/login-binding'
import { resolveLoginLinkOutcome } from '~/server/services/login-link-outcome'

const BASE_URL = 'http://localhost:3000'

const verifyUrlOf = (bufferUrl: string) => new URL(bufferUrl).searchParams.get('url')!

const openBufferPage = async (bufferUrl: string) => (await resolveLoginLinkOutcome(verifyUrlOf(bufferUrl))).kind

const signInWithOtp = (email: string, otp: string) =>
  POST(
    new Request(`${BASE_URL}/api/auth/sign-in/email-otp`, {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
      headers: { 'content-type': 'application/json', origin: BASE_URL },
    }),
  )

const isLinkConsumable = async (bufferUrl: string) => {
  const response = await GET(new Request(verifyUrlOf(bufferUrl)))
  return !new URL(response.headers.get('location')!).searchParams.has('error')
}

const sessionsOf = (userId: string) => getTestDb().select().from(session).where(eq(session.userId, userId))

/** Un scanner exécute le JavaScript de la page tampon et consomme le jeton, sans le cookie du gestionnaire. */
const scannerOpens = async (bufferUrl: string) => {
  const response = await GET(new Request(verifyUrlOf(bufferUrl), { headers: { 'user-agent': 'Mail-Scanner/1.0' } }))
  expect(response.headers.get('location')).not.toContain('error=')
}

async function requestLink(id: string) {
  const email = `${id}@bailleur.fr`
  await createUser({ id, name: 'Gestionnaire', email, role: 'owner' })
  await sendMagicLink(email, 'owner', '/bailleur/tableau-de-bord')
  return sentEmails.at(-1)!
}

beforeEach(() => {
  sentEmails.length = 0
  testCookies.clear()
})

describe('connexion gestionnaire : code de secours quand un scanner a consommé le lien', () => {
  it('envoie un code à 6 chiffres avec le lien et pose le cookie de liaison', async () => {
    const sent = await requestLink('otp-envoi')

    expect(sent.otp).toMatch(/^\d{6}$/)
    expect(testCookies.get(LOGIN_BINDING_COOKIE)?.value).toBeTruthy()
  })

  it('garde la redirection habituelle tant que le lien n’a pas servi, avec ou sans cookie', async () => {
    const sent = await requestLink('otp-parcours-habituel')
    expect(await openBufferPage(sent.url)).toBe('redirect')

    testCookies.clear()
    expect(await openBufferPage(sent.url)).toBe('redirect')
    expect(await isLinkConsumable(sent.url)).toBe(true)
  })

  it('reconnaît le navigateur d’origine quand un scanner a consommé le lien, et le connecte', async () => {
    const sent = await requestLink('otp-scanner-meme-navigateur')
    await scannerOpens(sent.url)

    expect(await openBufferPage(sent.url)).toBe('recover')

    const scannerSessions = await sessionsOf('otp-scanner-meme-navigateur')
    expect(scannerSessions).toHaveLength(1)

    expect(await recoverLoginWithBinding(verifyUrlOf(sent.url))).toEqual({ success: true })

    const sessions = await sessionsOf('otp-scanner-meme-navigateur')
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.id).not.toBe(scannerSessions[0]!.id)
  })

  it('demande le code quand un scanner a consommé le lien et que le cookie est absent', async () => {
    const sent = await requestLink('otp-scanner-autre-appareil')
    await scannerOpens(sent.url)
    testCookies.clear()

    expect(await openBufferPage(sent.url)).toBe('otp')
    expect(await recoverLoginWithBinding(verifyUrlOf(sent.url))).toEqual({ success: false })

    const [scannerSession] = await sessionsOf('otp-scanner-autre-appareil')

    const response = await signInWithOtp(sent.email, sent.otp!)
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('session_token')

    const sessions = await sessionsOf('otp-scanner-autre-appareil')
    expect(sessions.map((row) => row.id)).not.toContain(scannerSession!.id)
  })

  it('ne reconnaît pas un cookie d’un autre navigateur', async () => {
    const sent = await requestLink('otp-cookie-etranger')
    await scannerOpens(sent.url)
    testCookies.set(LOGIN_BINDING_COOKIE, 'cookie-d-un-autre-navigateur')

    expect(await openBufferPage(sent.url)).toBe('otp')
  })

  it('invalide le lien après une connexion par code', async () => {
    const sent = await requestLink('otp-invalide-lien')

    expect((await signInWithOtp(sent.email, sent.otp!)).status).toBe(200)

    expect(await isLinkConsumable(sent.url)).toBe(false)
    const [attempt] = await getTestDb().select().from(loginAttempts).where(eq(loginAttempts.email, sent.email))
    expect(attempt?.status).toBe(ELoginAttemptStatus.COMPLETED)
  })

  it('propose de renvoyer un code quand le lien a expiré', async () => {
    const sent = await requestLink('otp-expire')
    await getTestDb()
      .update(loginAttempts)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(loginAttempts.email, sent.email))

    expect(await resolveLoginLinkOutcome(verifyUrlOf(sent.url))).toMatchObject({ kind: 'otp', isCodeExpired: true })
  })

  it('garde la redirection habituelle pour un lien envoyé avant le déploiement', async () => {
    await createUser({ id: 'otp-ancien-lien', name: 'Gestionnaire', email: 'otp-ancien-lien@bailleur.fr', role: 'owner' })
    await recordMagicLinkSent({ email: 'otp-ancien-lien@bailleur.fr', token: 'jeton-avant-deploiement' })

    const outcome = await resolveLoginLinkOutcome(`${BASE_URL}/api/auth/magic-link/verify?token=jeton-avant-deploiement`)

    expect(outcome.kind).toBe('redirect')
  })

  it('renvoie vers la page d’erreur pour un jeton inconnu', async () => {
    const sent = await requestLink('otp-inconnu')
    const verifyUrl = new URL(verifyUrlOf(sent.url))
    verifyUrl.searchParams.set('token', 'jeton-inconnu')

    expect(await resolveLoginLinkOutcome(verifyUrl.toString())).toEqual({ kind: 'error', redirectTo: '/verification/erreur?role=owner' })
  })

  it('refuse le bon code après 3 essais incorrects', async () => {
    const sent = await requestLink('otp-brute-force')
    const wrong = sent.otp === '000000' ? '111111' : '000000'

    for (let i = 0; i < 3; i++) {
      expect((await signInWithOtp(sent.email, wrong)).status).toBe(400)
    }

    expect((await signInWithOtp(sent.email, sent.otp!)).status).toBe(403)
  })

  it('ne garde valable que le dernier code envoyé', async () => {
    const first = await requestLink('otp-renvoi')
    await sendMagicLink(first.email, 'owner', '/bailleur/tableau-de-bord')
    const second = sentEmails.at(-1)!

    if (first.otp !== second.otp) {
      expect((await signInWithOtp(first.email, first.otp!)).status).toBe(400)
    }
    expect((await signInWithOtp(first.email, second.otp!)).status).toBe(200)
  })

  it('plafonne à 3 envois par email sur 10 minutes, sans le signaler', async () => {
    const { email } = await requestLink('otp-plafond')
    for (let i = 0; i < 3; i++) {
      expect(await sendMagicLink(email, 'owner', '/bailleur/tableau-de-bord')).toEqual({ success: true })
    }

    expect(sentEmails).toHaveLength(3)
  })

  it('n’expose pas les autres routes du plugin de code', async () => {
    await createUser({ id: 'otp-etudiant', name: 'Étudiant', email: 'otp-etudiant@mail.fr', role: 'user' })

    const response = await POST(
      new Request(`${BASE_URL}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        body: JSON.stringify({ email: 'otp-etudiant@mail.fr', type: 'sign-in' }),
        headers: { 'content-type': 'application/json', origin: BASE_URL },
      }),
    )

    expect(response.status).toBe(404)
  })
})
