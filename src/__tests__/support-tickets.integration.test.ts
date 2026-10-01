import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ESupportTicketCategory, ESupportTicketStatus } from '~/enums/support-ticket'
import { supportTickets } from '~/server/db/schema'
import { createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { adminCaller, authenticatedCaller, caller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'

const sendRawEmail = vi.fn().mockResolvedValue(undefined)
vi.mock('~/server/services/brevo', async () => {
  const actual = await vi.importActual<typeof import('~/server/services/brevo')>('~/server/services/brevo')
  return { ...actual, sendRawEmail: (...args: unknown[]) => sendRawEmail(...args) }
})

beforeEach(async () => {
  sendRawEmail.mockClear()
  await createUser({ id: 'test-user-id', email: 'test@test.com', name: 'Test User' })
})

describe('supportTickets.create', () => {
  it('stores the ticket and notifies the support mailbox', async () => {
    await authenticatedCaller.supportTickets.create({
      category: ESupportTicketCategory.SEARCH,
      message: '  La carte ne charge pas sur mobile  ',
    })

    const rows = await getTestDb().select().from(supportTickets).where(eq(supportTickets.userId, 'test-user-id'))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ category: 'search', message: 'La carte ne charge pas sur mobile', status: 'open' })

    expect(sendRawEmail).toHaveBeenCalledTimes(1)
    const [email] = sendRawEmail.mock.calls[0] as [{ to: string[]; subject: string; textContent: string }]
    expect(email.to).toEqual(['tickets@test.local'])
    expect(email.subject).toBe('[Ticket support] Recherche de logement')
    expect(email.textContent).toContain('La carte ne charge pas sur mobile')
    expect(email).not.toHaveProperty('htmlContent')
  })

  it('rejects an anonymous visitor', async () => {
    await expect(
      caller.supportTickets.create({ category: ESupportTicketCategory.OTHER, message: 'Un message assez long' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('rejects a message shorter than the minimum', async () => {
    await expect(
      authenticatedCaller.supportTickets.create({ category: ESupportTicketCategory.OTHER, message: 'court' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('rate limits after five tickets in a day', async () => {
    for (let i = 0; i < 5; i++) {
      await authenticatedCaller.supportTickets.create({
        category: ESupportTicketCategory.OTHER,
        message: `Message de test numéro ${i}`,
      })
    }

    await expect(
      authenticatedCaller.supportTickets.create({ category: ESupportTicketCategory.OTHER, message: 'Un sixième message' }),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
  })
})

describe('supportTickets.admin', () => {
  it('lists tickets with status counts and updates a status', async () => {
    await authenticatedCaller.supportTickets.create({
      category: ESupportTicketCategory.ACCOUNT,
      message: 'Impossible de me connecter avec le lien magique',
    })

    const list = await adminCaller.supportTickets.admin.list({ page: 1 })
    expect(list.total).toBe(1)
    expect(list.statusCounts[ESupportTicketStatus.OPEN]).toBe(1)
    const ticket = list.items[0]
    expect(ticket).toMatchObject({ category: 'account', status: 'open', userEmail: 'test@test.com' })

    await adminCaller.supportTickets.admin.updateStatus({ id: ticket.id, status: ESupportTicketStatus.RESOLVED })

    const resolved = await adminCaller.supportTickets.admin.list({ page: 1, status: ESupportTicketStatus.RESOLVED })
    expect(resolved.total).toBe(1)
    expect(resolved.items[0].id).toBe(ticket.id)
  })

  it('forbids a non-admin from listing tickets', async () => {
    await expect(authenticatedCaller.supportTickets.admin.list({ page: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
