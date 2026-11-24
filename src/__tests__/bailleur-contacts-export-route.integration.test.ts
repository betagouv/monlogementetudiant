import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { formatIsoDate } from '~/utils/date-helpers'
import { activityLog } from '../server/db/schema/activity-log'
import { user } from '../server/db/schema/auth'
import { contactRequests } from '../server/db/schema/contacts'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

type TMockUser = {
  id: string
  role: 'admin' | 'owner' | 'user'
  bailleurRole?: 'administrator' | 'gestionnaire' | null
  bailleurPermissions?: string[]
}

const mockSession = vi.hoisted(() => ({ current: null as null | { user: TMockUser } }))

vi.mock('~/services/better-auth', () => ({
  getServerSession: vi.fn(() => mockSession.current),
}))

import { GET } from '~/app/api/bailleur/contacts/export/route'

const request = (query = '') => new NextRequest(`http://localhost/api/bailleur/contacts/export?${query}`)

let ownerId: number
let resA: { id: number }

beforeEach(async () => {
  await createUser({ id: 'owner-id', role: 'owner', email: 'owner@test.com', name: 'Owner' })
  const owner = await createOwner({ name: 'Bailleur A', slug: 'bailleur-a', userId: 'owner-id', contactMode: EOwnerContactMode.CONTACTS })
  ownerId = owner.id
  await getTestDb().update(user).set({ bailleurRole: 'administrator', ownerId }).where(eq(user.id, 'owner-id'))
  resA = await createAccommodation({ slug: 'res-a', name: 'Résidence A', ownerId })
  mockSession.current = { user: { id: 'owner-id', role: 'owner', bailleurRole: 'administrator', bailleurPermissions: [] } }
})

describe('GET /api/bailleur/contacts/export', () => {
  it('refuse un visiteur non connecté', async () => {
    mockSession.current = null
    expect((await GET(request())).status).toBe(401)
  })

  it('refuse un étudiant', async () => {
    mockSession.current = { user: { id: 'owner-id', role: 'user' } }
    expect((await GET(request())).status).toBe(403)
  })

  it('refuse un gestionnaire sans la permission manage_applications', async () => {
    mockSession.current = { user: { id: 'owner-id', role: 'owner', bailleurRole: 'gestionnaire', bailleurPermissions: [] } }
    expect((await GET(request())).status).toBe(403)
  })

  it('rejette un ownerId non entier', async () => {
    expect((await GET(request('ownerId=abc'))).status).toBe(400)
  })

  it('renvoie 404 pour une résidence hors bailleur', async () => {
    expect((await GET(request('residence=inconnue'))).status).toBe(404)
  })

  it('renvoie le CSV des coordonnées', async () => {
    await getTestDb().insert(contactRequests).values({
      accommodationId: resA.id,
      firstname: 'Camille',
      lastname: 'Martin',
      email: 'camille@test.com',
      status: EContactStatus.A_CONTACTER,
      confirmedAt: new Date(),
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('Content-Disposition')).toBe(
      `attachment; filename="contacts-bailleur-a-${formatIsoDate(new Date())}.csv"`,
    )
    const [header, line] = (await response.text()).replace(/^﻿/, '').split('\n')
    expect(header).toBe(
      "Résidence;Ville;Département;Région;Nom;E-mail;Téléphone;Date de naissance;Boursier;Alternance;Établissement;Année d'études;Type de logement;Statut;Date de la demande",
    )
    expect(line).toContain('Camille Martin;camille@test.com')
  })

  it('neutralise une formule dans le nom', async () => {
    await getTestDb().insert(contactRequests).values({
      accommodationId: resA.id,
      firstname: '=HYPERLINK("x")',
      email: 'f@test.com',
      status: EContactStatus.A_CONTACTER,
      confirmedAt: new Date(),
    })

    const body = await (await GET(request())).text()

    expect(body).toContain(`"'=HYPERLINK(""x"")"`)
  })

  it('trace l’export dans le journal d’activité', async () => {
    await GET(request('region=%C3%8Ele-de-France'))

    const [entry] = await getTestDb().select().from(activityLog).where(eq(activityLog.action, 'contacts.exported'))
    expect(entry).toMatchObject({
      userId: 'owner-id',
      entityType: 'owner',
      entityId: String(ownerId),
      ownerId,
      metadata: { region: 'Île-de-France', residence: null, rowCount: 0 },
    })
  })
})
