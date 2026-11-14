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
import { deleteBrevoBlockedContact, syncAndUnblockManagers, unblockOwnerOnLogin } from '~/server/services/brevo-unblock'

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

describe('syncAndUnblockManagers', () => {
  it('ne débloque que le gestionnaire désabonné et conserve la copie des autres', async () => {
    await seedManagers()
    const deleted = stubBrevo(brevoList)

    const result = await syncAndUnblockManagers()

    expect(deleted).toEqual(['unsub@bailleur.fr'])
    expect(result).toEqual({ blocked: 4, unblocked: 1, errors: 0 })
    const copy = await db.select().from(brevoBlockedContacts)
    expect(copy.map((c) => c.email).sort()).toEqual(['blocked@bailleur.fr', 'bounce@bailleur.fr', 'spam@bailleur.fr'])
    const events = await db.select().from(brevoUnblockEvents)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      email: 'unsub@bailleur.fr',
      userId: 'm-unsub',
      reason: 'unsubscribedViaEmail',
      trigger: 'scheduled',
      status: 'success',
    })
  })

  it('remplace entièrement la copie à chaque synchro', async () => {
    await seedManagers()
    stubBrevo(brevoList)
    await syncAndUnblockManagers()
    stubBrevo([{ email: 'bounce@bailleur.fr', reason: 'hardBounce' }])
    await syncAndUnblockManagers()
    const copy = await db.select().from(brevoBlockedContacts)
    expect(copy.map((c) => c.email)).toEqual(['bounce@bailleur.fr'])
  })

  it('enregistre un succès quand Brevo répond 404', async () => {
    await seedManagers()
    stubBrevo(brevoList, () => 404)
    const result = await syncAndUnblockManagers()
    expect(result.unblocked).toBe(1)
    const [event] = await db.select().from(brevoUnblockEvents)
    expect(event.status).toBe('success')
  })

  it('enregistre une erreur sur 500 et poursuit avec les suivants', async () => {
    await seedManagers()
    await createUser({ id: 'm-unsub2', name: 'Unsub2', email: 'unsub2@bailleur.fr', role: 'owner' })
    const deleted = stubBrevo([...brevoList, { email: 'unsub2@bailleur.fr', reason: 'unsubscribedViaApi' }], (email) =>
      email === 'unsub@bailleur.fr' ? 500 : 204,
    )

    const result = await syncAndUnblockManagers()

    expect(deleted).toEqual(['unsub@bailleur.fr', 'unsub2@bailleur.fr'])
    expect(result).toMatchObject({ unblocked: 1, errors: 1 })
    const events = await db.select().from(brevoUnblockEvents)
    expect(events.find((e) => e.email === 'unsub@bailleur.fr')).toMatchObject({ status: 'error', error: 'Brevo unblock failed: 500' })
    expect(events.find((e) => e.email === 'unsub2@bailleur.fr')?.status).toBe('success')
    const copy = await db.select().from(brevoBlockedContacts)
    expect(copy.map((c) => c.email)).toContain('unsub@bailleur.fr')
    expect(copy.map((c) => c.email)).not.toContain('unsub2@bailleur.fr')
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
        trigger: 'scheduled' as const,
        status: 'success' as const,
        createdAt: new Date(Date.UTC(2026, 10, 1, 0, i)),
      })),
    )

    const first = await adminCaller.admin.reminders.unblockHistory({ page: 1 })
    const second = await adminCaller.admin.reminders.unblockHistory({ page: 2 })

    expect(first).toMatchObject({ total: 25, pageCount: 2 })
    expect(first.rows).toHaveLength(20)
    expect(second.rows).toHaveLength(5)
    expect(first.rows[0]).toMatchObject({ userName: 'Marie Gestionnaire', reason: 'unsubscribedViaEmail', trigger: 'scheduled' })
    expect(first.rows[0].createdAt.getTime()).toBeGreaterThan(first.rows[1].createdAt.getTime())
  })
})
