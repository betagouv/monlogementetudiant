import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { EContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { user } from '../server/db/schema/auth'
import { bailleurAccommodationScopes } from '../server/db/schema/bailleur-accommodation-scopes'
import { contactRequests } from '../server/db/schema/contacts'
import { owners } from '../server/db/schema/owners'
import {
  createAccommodation,
  createDossierFacileApplication,
  createDossierFacileTenant,
  createOwner,
  createUser,
} from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { gestionnaireCallerFactory, ownerCaller } from './helpers/test-caller'

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS)

let ownerId: number
let resA: { id: number; slug: string }
let resB: { id: number; slug: string }

const addRequest = async (
  accommodationId: number,
  status: EContactStatus,
  opts: { createdAt?: Date; confirmed?: boolean; anonymized?: boolean; contactedAt?: Date } = {},
) => {
  const { createdAt = new Date(), confirmed = true, anonymized = false, contactedAt } = opts
  await getTestDb()
    .insert(contactRequests)
    .values({
      accommodationId,
      email: anonymized ? null : `${crypto.randomUUID()}@test.com`,
      status,
      createdAt,
      confirmedAt: confirmed ? new Date() : null,
      anonymizedAt: anonymized ? new Date() : null,
      contactedAt,
    })
}

beforeEach(async () => {
  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
  const owner = await createOwner({
    name: 'Bailleur A',
    slug: 'bailleur-a',
    userId: 'test-owner-id',
    contactMode: EOwnerContactMode.CONTACTS,
  })
  ownerId = owner.id
  await getTestDb().update(user).set({ bailleurRole: 'administrator', ownerId }).where(eq(user.id, 'test-owner-id'))
  resA = await createAccommodation({ slug: 'res-a', name: 'Res A', ownerId })
  resB = await createAccommodation({ slug: 'res-b', name: 'Res B', ownerId })
})

describe('bailleur.contactStats', () => {
  it('compte les demandes déposées dans la période, anonymisées incluses', async () => {
    await addRequest(resA.id, EContactStatus.A_CONTACTER)
    await addRequest(resA.id, EContactStatus.CONTACTE, { createdAt: daysAgo(10), contactedAt: daysAgo(9) })
    await addRequest(resA.id, EContactStatus.LOGEMENT_ATTRIBUE, { createdAt: daysAgo(40), anonymized: true, contactedAt: daysAgo(39) })

    const wide = await ownerCaller.bailleur.contactStats({ period: '90d' })
    const rowA = wide.rows.find((r) => r.accommodationId === resA.id)
    expect(rowA).toMatchObject({ received: 3, nonModere: 1, contacte: 1, logementAttribue: 1, nonRetenu: 0 })
    expect(wide.total.received).toBe(3)

    const narrow = await ownerCaller.bailleur.contactStats({ period: '30d' })
    expect(narrow.rows.find((r) => r.accommodationId === resA.id)?.received).toBe(2)
  })

  it('ne compte pas une demande visiteur non confirmée', async () => {
    await addRequest(resA.id, EContactStatus.A_CONTACTER, { confirmed: false })
    const res = await ownerCaller.bailleur.contactStats({ period: '30d' })
    expect(res.total.received).toBe(0)
  })

  it('masque une résidence fermée sans demande, la garde si elle a des demandes', async () => {
    const db = getTestDb()
    const { accommodations } = await import('../server/db/schema/accommodations')
    await db.update(accommodations).set({ acceptsApplications: false }).where(eq(accommodations.id, resA.id))
    await db.update(accommodations).set({ acceptsApplications: false }).where(eq(accommodations.id, resB.id))
    await addRequest(resB.id, EContactStatus.NON_RETENU)

    const res = await ownerCaller.bailleur.contactStats({ period: '30d' })
    expect(res.rows.map((r) => r.accommodationId)).toEqual([resB.id])
    expect(res.rows[0]?.nonRetenu).toBe(1)
  })

  it('restreint un gestionnaire à son périmètre', async () => {
    const db = getTestDb()
    await createUser({ id: 'gest-1', email: 'g@a.com', role: 'owner' })
    await db
      .update(user)
      .set({ ownerId, bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_applications'], applicationScopeRestricted: true })
      .where(eq(user.id, 'gest-1'))
    await db.insert(bailleurAccommodationScopes).values({ userId: 'gest-1', accommodationId: resA.id })
    await addRequest(resA.id, EContactStatus.A_CONTACTER)
    await addRequest(resB.id, EContactStatus.A_CONTACTER)
    await addRequest(resB.id, EContactStatus.CONTACTE)

    const res = await gestionnaireCallerFactory({
      id: 'gest-1',
      email: 'g@a.com',
      permissions: ['manage_applications'],
    }).bailleur.contactStats({
      period: '30d',
    })
    expect(res.rows.map((r) => r.accommodationId)).toEqual([resA.id])
    expect(res.total.received).toBe(1)
  })

  it('mode dossier_facile : ignore une candidature de locataire non vérifié', async () => {
    await getTestDb().update(owners).set({ contactMode: EOwnerContactMode.DOSSIER_FACILE }).where(eq(owners.id, ownerId))
    await addRequest(resA.id, EContactStatus.A_CONTACTER)
    const student1 = await createUser({ id: 'student-1', email: 's1@test.com' })
    const student2 = await createUser({ id: 'student-2', email: 's2@test.com' })
    const verified = await createDossierFacileTenant({ userId: student1.id })
    const pending = await createDossierFacileTenant({ userId: student2.id, status: 'pending' })
    await createDossierFacileApplication({
      tenantId: verified.id,
      accommodationSlug: resA.slug,
      apartmentType: 't1',
      status: EContactStatus.CONTACTE,
    })
    await createDossierFacileApplication({
      tenantId: pending.id,
      accommodationSlug: resA.slug,
      apartmentType: 't1',
      status: EContactStatus.A_MODERER,
    })

    const res = await ownerCaller.bailleur.contactStats({ period: '30d' })
    expect(res.rows.find((r) => r.accommodationId === resA.id)).toMatchObject({ received: 1, contacte: 1, nonModere: 0 })
    expect(res.total.received).toBe(1)
  })

  it('mode none : aucune ligne', async () => {
    await getTestDb().update(owners).set({ contactMode: EOwnerContactMode.NONE }).where(eq(owners.id, ownerId))
    const res = await ownerCaller.bailleur.contactStats({ period: '30d' })
    expect(res.rows).toEqual([])
    expect(res.total.received).toBe(0)
  })
})
