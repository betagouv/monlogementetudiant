import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '~/server/db'
import { brevoBlockedContacts, brevoUnblockEvents } from '~/server/db/schema/brevo-unblock'
import { createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { adminCaller } from './helpers/test-caller'

vi.mock('next/headers', async () => {
  const { testCookies } = await import('./helpers/test-cookies')
  return { headers: () => new Headers(), cookies: async () => testCookies }
})

const calls = vi.hoisted(() => [] as string[])
const mockedEnv = vi.hoisted(() => ({}) as Record<string, unknown>)

vi.mock('~/server/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/server/env')>()
  Object.assign(mockedEnv, actual.env, { NEXT_PUBLIC_APP_ENV: 'production' })
  return { env: mockedEnv }
})

vi.mock('~/services/better-auth', () => ({
  auth: {
    api: {
      signInMagicLink: vi.fn(async () => {
        calls.push('signInMagicLink')
        return { status: true }
      }),
    },
  },
}))

import { sendMagicLink } from '~/components/magic-link-sign-in/actions'
import { deleteBrevoBlockedContact, syncBlockedManagers, unblockOwnerOnLogin } from '~/server/services/brevo-unblock'

type TContact = { email: string; reason: string }

const stubBrevo = (contacts: TContact[], deleteStatus: (email: string) => number = () => 204) => {
  const deleted: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (init?.method === 'DELETE') {
        const email = decodeURIComponent(url.pathname.split('/').pop() ?? '')
        deleted.push(email)
        calls.push(`DELETE ${email}`)
        const status = deleteStatus(email)
        return { ok: status < 300, status, json: async () => ({}) }
      }
      const page = url.searchParams.get('offset') === '0' ? contacts : []
      return {
        ok: true,
        status: 200,
        json: async () => ({
          contacts: page.map((c) => ({ email: c.email, blockedAt: '2026-11-01T10:00:00.000Z', reason: { code: c.reason } })),
        }),
      }
    }),
  )
  return deleted
}

const seedManagers = async () => {
  await createUser({ id: 'm-unsub', name: 'Unsub', email: 'unsub@bailleur.fr', role: 'owner' })
  await createUser({ id: 'm-bounce', name: 'Bounce', email: 'bounce@bailleur.fr', role: 'owner' })
  await createUser({ id: 'm-spam', name: 'Spam', email: 'spam@bailleur.fr', role: 'owner' })
  await createUser({ id: 'm-admin', name: 'Admin blocked', email: 'blocked@bailleur.fr', role: 'owner' })
  await createUser({ id: 'student', name: 'Étudiant', email: 'etu@univ.fr', role: 'user' })
}

const brevoList: TContact[] = [
  { email: 'unsub@bailleur.fr', reason: 'unsubscribedViaEmail' },
  { email: 'bounce@bailleur.fr', reason: 'hardBounce' },
  { email: 'spam@bailleur.fr', reason: 'contactFlaggedAsSpam' },
  { email: 'blocked@bailleur.fr', reason: 'adminBlocked' },
  { email: 'etu@univ.fr', reason: 'unsubscribedViaEmail' },
]

beforeEach(() => {
  calls.length = 0
  mockedEnv.NEXT_PUBLIC_APP_ENV = 'production'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('deleteBrevoBlockedContact', () => {
  it('traite 204 et 404 comme un succès, lève sur les autres statuts', async () => {
    stubBrevo([], (email) => ({ 'a@x.fr': 204, 'b@x.fr': 404, 'c@x.fr': 500 })[email] ?? 204)
    await expect(deleteBrevoBlockedContact('a@x.fr')).resolves.toBeUndefined()
    await expect(deleteBrevoBlockedContact('b@x.fr')).resolves.toBeUndefined()
    await expect(deleteBrevoBlockedContact('c@x.fr')).rejects.toThrow('Brevo unblock failed: 500')
  })
})

describe('syncBlockedManagers', () => {
  it('copie les gestionnaires bloqués sans débloquer personne', async () => {
    await seedManagers()
    const deleted = stubBrevo(brevoList)

    const result = await syncBlockedManagers()

    expect(deleted).toEqual([])
    expect(result).toEqual({ blocked: 4 })
    const copy = await db.select().from(brevoBlockedContacts)
    expect(copy.map((c) => c.email).sort()).toEqual(['blocked@bailleur.fr', 'bounce@bailleur.fr', 'spam@bailleur.fr', 'unsub@bailleur.fr'])
    expect(await db.select().from(brevoUnblockEvents)).toHaveLength(0)
  })

  it('remplace entièrement la copie à chaque synchro', async () => {
    await seedManagers()
    stubBrevo(brevoList)
    await syncBlockedManagers()
    stubBrevo([{ email: 'bounce@bailleur.fr', reason: 'hardBounce' }])
    await syncBlockedManagers()
    const copy = await db.select().from(brevoBlockedContacts)
    expect(copy.map((c) => c.email)).toEqual(['bounce@bailleur.fr'])
  })

  it('alimente la copie utilisée par le déblocage à la demande de lien', async () => {
    await seedManagers()
    stubBrevo(brevoList)
    await syncBlockedManagers()
    const deleted = stubBrevo([])

    await unblockOwnerOnLogin('unsub@bailleur.fr')

    expect(deleted).toEqual(['unsub@bailleur.fr'])
    expect((await db.select().from(brevoBlockedContacts)).map((c) => c.email)).not.toContain('unsub@bailleur.fr')
  })
})

describe('hors production', () => {
  it('syncBlockedManagers ne contacte pas Brevo', async () => {
    mockedEnv.NEXT_PUBLIC_APP_ENV = 'staging'
    await seedManagers()
    stubBrevo(brevoList)

    expect(await syncBlockedManagers()).toEqual({ blocked: 0 })

    expect(fetch).not.toHaveBeenCalled()
    expect(await db.select().from(brevoBlockedContacts)).toHaveLength(0)
  })

  it('unblockOwnerOnLogin ne contacte pas Brevo', async () => {
    mockedEnv.NEXT_PUBLIC_APP_ENV = 'staging'
    await seedManagers()
    await db.insert(brevoBlockedContacts).values({
      email: 'unsub@bailleur.fr',
      userId: 'm-unsub',
      reason: 'unsubscribedViaEmail',
      blockedAt: new Date(),
      syncedAt: new Date(),
    })
    stubBrevo([])

    await unblockOwnerOnLogin('unsub@bailleur.fr')

    expect(fetch).not.toHaveBeenCalled()
    expect(await db.select().from(brevoUnblockEvents)).toHaveLength(0)
    expect(await db.select().from(brevoBlockedContacts)).toHaveLength(1)
  })
})

describe('unblockOwnerOnLogin', () => {
  const seedCopy = async (email: string, userId: string, reason: string) => {
    await db.insert(brevoBlockedContacts).values({ email, userId, reason, blockedAt: new Date(), syncedAt: new Date() })
  }

  it('débloque un gestionnaire éligible et enregistre un événement login', async () => {
    await seedManagers()
    await seedCopy('unsub@bailleur.fr', 'm-unsub', 'unsubscribedViaMA')
    const deleted = stubBrevo([])

    await unblockOwnerOnLogin('Unsub@Bailleur.fr')

    expect(deleted).toEqual(['unsub@bailleur.fr'])
    const [event] = await db.select().from(brevoUnblockEvents)
    expect(event).toMatchObject({ trigger: 'login', status: 'success', userId: 'm-unsub' })
    expect(await db.select().from(brevoBlockedContacts)).toHaveLength(0)
  })

  it('ne fait aucun appel pour un motif non éligible ou une adresse absente', async () => {
    await seedManagers()
    await seedCopy('bounce@bailleur.fr', 'm-bounce', 'hardBounce')
    const deleted = stubBrevo([])

    await unblockOwnerOnLogin('bounce@bailleur.fr')
    await unblockOwnerOnLogin('inconnu@bailleur.fr')

    expect(deleted).toEqual([])
    expect(await db.select().from(brevoUnblockEvents)).toHaveLength(0)
  })

  it('ne lève pas quand le DELETE échoue et journalise une erreur', async () => {
    await seedManagers()
    await seedCopy('unsub@bailleur.fr', 'm-unsub', 'unsubscribedViaEmail')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('réseau')
      }),
    )

    await expect(unblockOwnerOnLogin('unsub@bailleur.fr')).resolves.toBeUndefined()

    const [event] = await db.select().from(brevoUnblockEvents)
    expect(event).toMatchObject({ trigger: 'login', status: 'error', error: 'réseau' })
  })
})

describe('sendMagicLink', () => {
  it('débloque le gestionnaire éligible avant d’envoyer le lien', async () => {
    await seedManagers()
    await db.insert(brevoBlockedContacts).values({
      email: 'unsub@bailleur.fr',
      userId: 'm-unsub',
      reason: 'unsubscribedViaEmail',
      blockedAt: new Date(),
      syncedAt: new Date(),
    })
    stubBrevo([])

    const result = await sendMagicLink('Unsub@bailleur.fr', 'owner')

    expect(result).toEqual({ success: true })
    expect(calls).toEqual(['DELETE unsub@bailleur.fr', 'signInMagicLink'])
  })

  it('ne tente aucun déblocage pour une demande côté administration', async () => {
    await createUser({ id: 'adm', name: 'Admin', email: 'adm@bailleur.fr', role: 'admin' })
    await db.insert(brevoBlockedContacts).values({
      email: 'adm@bailleur.fr',
      userId: 'adm',
      reason: 'unsubscribedViaEmail',
      blockedAt: new Date(),
      syncedAt: new Date(),
    })
    stubBrevo([])

    await sendMagicLink('adm@bailleur.fr', 'admin')

    expect(calls).toEqual(['signInMagicLink'])
  })

  it('envoie le lien malgré un appel Brevo qui ne répond pas, et journalise une erreur', async () => {
    await seedManagers()
    await db.insert(brevoBlockedContacts).values({
      email: 'unsub@bailleur.fr',
      userId: 'm-unsub',
      reason: 'unsubscribedViaEmail',
      blockedAt: new Date(),
      syncedAt: new Date(),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: string | URL, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
          }),
      ),
    )

    await sendMagicLink('unsub@bailleur.fr', 'owner')

    expect(calls).toEqual(['signInMagicLink'])
    const [event] = await db.select().from(brevoUnblockEvents)
    expect(event).toMatchObject({ trigger: 'login', status: 'error' })
  })

  it('envoie quand même le lien si le déblocage échoue', async () => {
    await seedManagers()
    await db.insert(brevoBlockedContacts).values({
      email: 'unsub@bailleur.fr',
      userId: 'm-unsub',
      reason: 'unsubscribedViaEmail',
      blockedAt: new Date(),
      syncedAt: new Date(),
    })
    stubBrevo([], () => 500)

    await sendMagicLink('unsub@bailleur.fr', 'owner')

    expect(calls).toEqual(['DELETE unsub@bailleur.fr', 'signInMagicLink'])
  })
})

describe('admin.reminders.unblockHistory', () => {
  it('pagine les événements par 20, du plus récent au plus ancien', async () => {
    await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })
    await createUser({ id: 'm1', name: 'Marie Gestionnaire', email: 'marie@bailleur.fr', role: 'owner' })
    await db.insert(brevoUnblockEvents).values(
      Array.from({ length: 25 }, (_, i) => ({
        email: 'marie@bailleur.fr',
        userId: 'm1',
        reason: 'unsubscribedViaEmail',
        trigger: 'login' as const,
        status: 'success' as const,
        createdAt: new Date(Date.UTC(2026, 10, 1, 0, i)),
      })),
    )

    const first = await adminCaller.admin.reminders.unblockHistory({ page: 1 })
    const second = await adminCaller.admin.reminders.unblockHistory({ page: 2 })

    expect(first).toMatchObject({ total: 25, pageCount: 2 })
    expect(first.rows).toHaveLength(20)
    expect(second.rows).toHaveLength(5)
    expect(first.rows[0]).toMatchObject({ userName: 'Marie Gestionnaire', reason: 'unsubscribedViaEmail' })
    expect(first.rows[0].createdAt.getTime()).toBeGreaterThan(first.rows[1].createdAt.getTime())
  })
})
