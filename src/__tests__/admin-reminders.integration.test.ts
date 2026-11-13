import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EReminderType } from '~/enums/reminder-email'
import { recordReminderEmail } from '~/server/reminders/record-reminder-email'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { adminCaller, ownerCaller } from './helpers/test-caller'

const RECAP_TEMPLATE = 64
const WARNING_TEMPLATE = 61

const range = { from: '2026-11-01', to: '2026-11-30' }
const sentAt = '2026-11-05T09:00:00.000Z'

type TEvent = { date: string; email: string; event: string; messageId: string; templateId: number }

const send = (messageId: string, email: string, templateId: number, extra: string[] = [], date = sentAt): TEvent[] =>
  ['requests', ...extra].map((event) => ({ date, email, event, messageId, templateId }))

const stubBrevo = ({ events = [], contacts = [] }: { events?: TEvent[]; contacts?: unknown[] }) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/blockedContacts')) {
        return { ok: true, status: 200, json: async () => ({ contacts: url.searchParams.get('offset') === '0' ? contacts : [] }) }
      }
      const templateId = Number(url.searchParams.get('templateId'))
      const forTemplate = url.searchParams.get('offset') === '0' ? events.filter((e) => e.templateId === templateId) : []
      return { ok: true, status: 200, json: async () => ({ events: forTemplate }) }
    }),
  )
}

beforeEach(async () => {
  await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })
  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('admin.reminders.sentEmails', () => {
  it('liste les relances parties avec destinataire, statut et efficacité', async () => {
    await createUser({
      id: 'jean-id',
      name: 'Jean Dupont',
      firstname: 'Jean',
      lastname: 'Dupont',
      email: 'Jean@Bailleur.fr',
      role: 'owner',
    })
    const owner = await createOwner({ name: 'Bailleur Jean', slug: 'bailleur-jean', userId: 'jean-id' })
    const res = await createAccommodation({ slug: 'res-jean', name: 'Res Jean', ownerId: owner.id })
    await recordReminderEmail({
      messageId: 'm-jean',
      type: EReminderType.AVAILABILITY_MONTHLY_RECAP,
      userId: 'jean-id',
      ownerId: owner.id,
      recipientEmail: 'Jean@Bailleur.fr',
      sentAt: new Date(sentAt),
      items: [{ accommodationId: res.id, reason: 'stale_availability' }],
    })
    stubBrevo({ events: send('m-jean', 'jean@bailleur.fr', RECAP_TEMPLATE, ['delivered', 'opened']) })

    const result = await adminCaller.admin.reminders.sentEmails(range)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      messageId: 'm-jean',
      type: EReminderType.AVAILABILITY_MONTHLY_RECAP,
      email: 'jean@bailleur.fr',
      userName: 'Jean Dupont',
      ownerId: owner.id,
      ownerName: 'Bailleur Jean',
      status: 'opened',
      residencesCount: 1,
    })
    expect(result.rows[0].efficacy).not.toBe('not_measured')
    expect(result.summary).toMatchObject({ sent: 1, delivered: 1, opened: 1 })
  })

  it('compte les tuiles sur tout le résultat filtré', async () => {
    const events = Array.from({ length: 30 }, (_, i) => send(`m-${i}`, `u${i}@x.fr`, RECAP_TEMPLATE, ['delivered'])).flat()
    stubBrevo({ events })

    const result = await adminCaller.admin.reminders.sentEmails(range)

    expect(result.rows).toHaveLength(25)
    expect(result.total).toBe(30)
    expect(result.pageCount).toBe(2)
    expect(result.summary.sent).toBe(30)
    expect(result.summary.delivered).toBe(30)
  })

  it('filtre par type de relance', async () => {
    stubBrevo({
      events: [...send('m-recap', 'a@x.fr', RECAP_TEMPLATE), ...send('m-warn', 'b@x.fr', WARNING_TEMPLATE)],
    })

    const result = await adminCaller.admin.reminders.sentEmails({ ...range, type: EReminderType.APPLICATIONS_INACTIVITY_WARNING })

    expect(result.rows.map((r) => r.messageId)).toEqual(['m-warn'])
    expect(result.rows[0].type).toBe(EReminderType.APPLICATIONS_INACTIVITY_WARNING)
    expect(result.summary.sent).toBe(1)
  })

  it('affiche « non mesuré » pour un e-mail absent de nos tables', async () => {
    stubBrevo({ events: send('m-unknown', 'inconnu@x.fr', RECAP_TEMPLATE) })

    const result = await adminCaller.admin.reminders.sentEmails(range)

    expect(result.rows[0]).toMatchObject({ efficacy: 'not_measured', residencesCount: null, userName: null, ownerId: null })
  })

  it('filtre par recherche sur l’adresse, le nom ou le bailleur', async () => {
    await createUser({ id: 'jean-id', name: 'Jean Dupont', email: 'jean@bailleur.fr', role: 'owner' })
    await createOwner({ name: 'Habitat Solidaire', slug: 'habitat', userId: 'jean-id' })
    stubBrevo({ events: [...send('m-1', 'jean@bailleur.fr', RECAP_TEMPLATE), ...send('m-2', 'autre@x.fr', RECAP_TEMPLATE)] })

    const byOwner = await adminCaller.admin.reminders.sentEmails({ ...range, search: 'habitat' })
    expect(byOwner.rows.map((r) => r.messageId)).toEqual(['m-1'])

    const byEmail = await adminCaller.admin.reminders.sentEmails({ ...range, search: 'AUTRE@' })
    expect(byEmail.rows.map((r) => r.messageId)).toEqual(['m-2'])
  })

  it('renvoie une erreur lisible si Brevo est indisponible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    )

    await expect(adminCaller.admin.reminders.sentEmails(range)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' })
  })

  it('refuse un compte gestionnaire', async () => {
    await expect(ownerCaller.admin.reminders.sentEmails(range)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('admin.reminders.blockedContacts', () => {
  const contacts = [
    { email: 'Jean@Bailleur.fr', blockedAt: '2026-11-10T10:00:00.000Z', senderEmail: 's@x.fr', reason: { code: 'unsubscribedViaEmail' } },
    { email: 'marie@bailleur.fr', blockedAt: '2026-11-12T10:00:00.000Z', senderEmail: 's@x.fr', reason: { code: 'hardBounce' } },
    { email: 'paul@bailleur.fr', blockedAt: '2026-09-01T10:00:00.000Z', senderEmail: 's@x.fr', reason: { code: 'unsubscribedViaMA' } },
    { email: 'etu@etudiant.fr', blockedAt: '2026-11-11T10:00:00.000Z', senderEmail: 's@x.fr', reason: { code: 'hardBounce' } },
  ]

  beforeEach(async () => {
    for (const [id, email, name] of [
      ['jean-id', 'jean@bailleur.fr', 'Jean'],
      ['marie-id', 'marie@bailleur.fr', 'Marie'],
      ['paul-id', 'paul@bailleur.fr', 'Paul'],
    ]) {
      await createUser({ id, name, email, role: 'owner' })
    }
    await createUser({ id: 'etu-id', name: 'Etu', email: 'etu@etudiant.fr', role: 'user' })
    await createOwner({ name: 'Bailleur Jean', slug: 'bailleur-jean', userId: 'jean-id' })
  })

  it('ne garde que les adresses bloquées de gestionnaires', async () => {
    stubBrevo({ contacts })

    const result = await adminCaller.admin.reminders.blockedContacts(range)

    expect(result.rows.map((r) => r.email).sort()).toEqual(['jean@bailleur.fr', 'marie@bailleur.fr'])
    expect(result.rows.find((r) => r.email === 'jean@bailleur.fr')).toMatchObject({ userName: 'Jean', ownerName: 'Bailleur Jean' })
    expect(result.summary.totalBlocked).toBe(3)
  })

  it('compte les désabonnements de la période', async () => {
    stubBrevo({ contacts })

    const result = await adminCaller.admin.reminders.blockedContacts(range)

    expect(result.summary).toEqual({ blockedInPeriod: 2, unsubscribedInPeriod: 1, totalBlocked: 3 })
  })

  it('filtre par motif', async () => {
    stubBrevo({ contacts })

    const result = await adminCaller.admin.reminders.blockedContacts({ ...range, reason: 'hardBounce' })

    expect(result.rows.map((r) => r.email)).toEqual(['marie@bailleur.fr'])
  })

  it('renvoie une erreur lisible si Brevo est indisponible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    )

    await expect(adminCaller.admin.reminders.blockedContacts(range)).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' })
  })
})
