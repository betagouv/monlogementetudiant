import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EAccommodationReportField } from '~/enums/accommodation-report-field'
import { ESupportTicketStatus } from '~/enums/support-ticket'
import { accommodationReports } from '~/server/db/schema'
import { createAccommodation, createOwner } from './fixtures/factories'
import './helpers/setup-integration'
import { adminCaller, authenticatedCaller, caller, guestCallerWithIp } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'

const sendRawEmail = vi.fn().mockResolvedValue(undefined)
vi.mock('~/server/services/brevo', async () => {
  const actual = await vi.importActual<typeof import('~/server/services/brevo')>('~/server/services/brevo')
  return { ...actual, sendRawEmail: (...args: unknown[]) => sendRawEmail(...args) }
})

beforeEach(() => {
  sendRawEmail.mockClear()
})

describe('accommodations.report', () => {
  it('stores the report and emails it as plain text', async () => {
    const owner = await createOwner({ name: 'Crous Créteil', slug: 'crous-creteil' })
    const accommodation = await createAccommodation({ name: 'Résidence Signalée', slug: 'res-signalee', ownerId: owner!.id })

    await caller.accommodations.report({
      slug: 'res-signalee',
      field: EAccommodationReportField.PRICE,
      details: '  Le loyer affiché est faux  ',
    })

    const rows = await getTestDb().select().from(accommodationReports).where(eq(accommodationReports.accommodationId, accommodation.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ field: 'price', details: 'Le loyer affiché est faux', status: 'open' })

    expect(sendRawEmail).toHaveBeenCalledTimes(1)
    const [email] = sendRawEmail.mock.calls[0] as [{ to: string[]; subject: string; textContent: string }]
    expect(email.to).toEqual(['signalements@test.local'])
    expect(email.subject).toBe('[Signalement logement] Résidence Signalée – Prix')
    expect(email.textContent).toContain('Gestionnaire : Crous Créteil')
    expect(email.textContent).toContain('Précisions : Le loyer affiché est faux')
    expect(email.textContent).toMatch(/URL du logement : .*\/trouver-un-logement-etudiant\/ville\/ville-test-\d+\/res-signalee/)
    expect(email.textContent).toContain('/administration/tickets?onglet=signalements')
    expect(email).not.toHaveProperty('htmlContent')
  })

  it('rejects an unpublished accommodation', async () => {
    await createAccommodation({ slug: 'res-cachee', published: false })

    await expect(caller.accommodations.report({ slug: 'res-cachee', field: EAccommodationReportField.AVAILABILITY })).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    )
    expect(sendRawEmail).not.toHaveBeenCalled()
  })

  it('rejects details longer than the limit', async () => {
    await createAccommodation({ slug: 'res-longue' })

    await expect(
      caller.accommodations.report({ slug: 'res-longue', field: EAccommodationReportField.OTHER, details: 'a'.repeat(1001) }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('rate limits reports from the same IP', async () => {
    await createAccommodation({ slug: 'res-spam' })
    const guest = guestCallerWithIp('203.0.113.7')

    for (let i = 0; i < 5; i++) {
      await guest.accommodations.report({ slug: 'res-spam', field: EAccommodationReportField.AVAILABILITY })
    }

    await expect(guest.accommodations.report({ slug: 'res-spam', field: EAccommodationReportField.AVAILABILITY })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    })
    await expect(
      guestCallerWithIp('203.0.113.8').accommodations.report({ slug: 'res-spam', field: EAccommodationReportField.AVAILABILITY }),
    ).resolves.toEqual({ success: true })
  })
})

describe('supportTickets.admin.reports', () => {
  it('lists reports with their residence and updates a status', async () => {
    const owner = await createOwner({ name: 'Crous Lyon', slug: 'crous-lyon' })
    await createAccommodation({ name: 'Résidence Admin', slug: 'res-admin', ownerId: owner!.id })
    await caller.accommodations.report({ slug: 'res-admin', field: EAccommodationReportField.AVAILABILITY, details: 'Complet' })

    const list = await adminCaller.supportTickets.admin.reports.list({ page: 1 })
    expect(list.total).toBe(1)
    expect(list.statusCounts).toEqual({ open: 1, in_progress: 0, resolved: 0 })
    const report = list.items[0]
    expect(report).toMatchObject({
      field: 'availability',
      details: 'Complet',
      status: 'open',
      accommodationName: 'Résidence Admin',
      accommodationSlug: 'res-admin',
      ownerName: 'Crous Lyon',
    })
    expect(report.citySlug).toMatch(/^ville-test-\d+$/)

    await adminCaller.supportTickets.admin.reports.updateStatus({ id: report.id, status: ESupportTicketStatus.RESOLVED })

    const resolved = await adminCaller.supportTickets.admin.reports.list({ page: 1, status: ESupportTicketStatus.RESOLVED })
    expect(resolved.items.map((item) => item.id)).toEqual([report.id])
    expect(await adminCaller.supportTickets.admin.reports.list({ page: 1, status: ESupportTicketStatus.OPEN })).toMatchObject({ total: 0 })
  })

  it('includes reports in the admin badge count', async () => {
    await createAccommodation({ slug: 'res-badge' })
    await caller.accommodations.report({ slug: 'res-badge', field: EAccommodationReportField.PRICE })

    expect(await adminCaller.supportTickets.admin.count()).toBe(1)
  })

  it('returns NOT_FOUND when updating an unknown report', async () => {
    await expect(
      adminCaller.supportTickets.admin.reports.updateStatus({
        id: 'ffffffff-ffff-4fff-bfff-ffffffffffff',
        status: ESupportTicketStatus.RESOLVED,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('forbids a non-admin from listing or updating reports', async () => {
    await expect(authenticatedCaller.supportTickets.admin.reports.list({ page: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      authenticatedCaller.supportTickets.admin.reports.updateStatus({
        id: 'ffffffff-ffff-4fff-bfff-ffffffffffff',
        status: ESupportTicketStatus.RESOLVED,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
