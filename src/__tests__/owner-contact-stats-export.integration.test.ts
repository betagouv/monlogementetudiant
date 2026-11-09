import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { user } from '../server/db/schema/auth'
import { bailleurAccommodationScopes } from '../server/db/schema/bailleur-accommodation-scopes'
import { contactRequests } from '../server/db/schema/contacts'
import { createAccommodation, createAdminOwnerLink, createOwner, createUser } from './fixtures/factories'
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

import { GET } from '~/app/api/bailleur/contacts/statistiques/export/route'

const request = (query = 'period=30d') => new NextRequest(`http://localhost/api/bailleur/contacts/statistiques/export?${query}`)

async function readCsv(response: Response) {
  const [headerLine, ...rows] = (await response.text()).replace(/^﻿/, '').split('\n')
  const headers = headerLine.split(';')
  return {
    headerLine,
    rows: rows.map((line) => Object.fromEntries(line.split(';').map((value, index) => [headers[index], value]))),
  }
}

const addRequest = (accommodationId: number, status: EContactStatus) =>
  getTestDb()
    .insert(contactRequests)
    .values({
      accommodationId,
      email: `${crypto.randomUUID()}@test.com`,
      status,
      createdAt: new Date(),
      confirmedAt: new Date(),
    })

let ownerId: number
let resA: { id: number }
let resB: { id: number }

beforeEach(async () => {
  await createUser({ id: 'owner-id', role: 'owner', email: 'owner@test.com', name: 'Owner' })
  const owner = await createOwner({
    name: 'Bailleur A',
    slug: 'bailleur-a',
    userId: 'owner-id',
    contactMode: EOwnerContactMode.CONTACTS,
  })
  ownerId = owner.id
  await getTestDb().update(user).set({ bailleurRole: 'administrator', ownerId }).where(eq(user.id, 'owner-id'))
  resA = await createAccommodation({ slug: 'res-a', name: 'Résidence A', ownerId })
  resB = await createAccommodation({ slug: 'res-b', name: 'Résidence B', ownerId })
  mockSession.current = { user: { id: 'owner-id', role: 'owner', bailleurRole: 'administrator', bailleurPermissions: [] } }
})

describe('GET /api/bailleur/contacts/statistiques/export', () => {
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

  it('rejette une période inconnue', async () => {
    expect((await GET(request('period=42d'))).status).toBe(400)
  })

  it('renvoie l’en-tête attendu, une ligne par résidence puis le total, sans donnée nominative', async () => {
    await addRequest(resA.id, EContactStatus.A_MODERER)
    await addRequest(resA.id, EContactStatus.CONTACTE)
    await addRequest(resA.id, EContactStatus.CONTACTE)
    await addRequest(resA.id, EContactStatus.NON_RETENU)

    const response = await GET(request())
    const { headerLine, rows } = await readCsv(response)

    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('Content-Disposition')).toContain('contacts-bailleur-a-30d-')
    expect(headerLine).toBe(
      'Résidence;Ville;Demandes reçues;Non modéré;Non modéré (%);Non retenu;Non retenu (%);Contacté;Contacté (%);Logement attribué;Logement attribué (%);Début de période;Fin de période',
    )
    expect(rows.map((row) => row.Résidence)).toEqual(['Résidence A', 'Résidence B', 'Total'])

    const a = rows[0]
    expect(a['Demandes reçues']).toBe('4')
    expect(a['Non modéré']).toBe('1')
    expect(a['Non modéré (%)']).toBe('25')
    expect(a.Contacté).toBe('2')
    expect(a['Contacté (%)']).toBe('50')
    expect(a['Logement attribué (%)']).toBe('0')

    const b = rows[1]
    expect(b['Demandes reçues']).toBe('0')
    expect(b['Contacté (%)']).toBe('')

    const total = rows[2]
    expect(total.Ville).toBe('')
    expect(total['Demandes reçues']).toBe('4')
    expect(total['Début de période']).toBe(a['Début de période'])
    expect(JSON.stringify(rows)).not.toContain('@')
  })

  it('borne les lignes au périmètre du gestionnaire', async () => {
    await createUser({ id: 'gest-id', role: 'owner', email: 'gest@test.com', name: 'Gest' })
    await getTestDb()
      .update(user)
      .set({ bailleurRole: 'gestionnaire', ownerId, bailleurPermissions: ['manage_applications'], applicationScopeRestricted: true })
      .where(eq(user.id, 'gest-id'))
    await getTestDb().insert(bailleurAccommodationScopes).values({ userId: 'gest-id', accommodationId: resA.id })
    await addRequest(resA.id, EContactStatus.CONTACTE)
    await addRequest(resB.id, EContactStatus.CONTACTE)
    mockSession.current = {
      user: { id: 'gest-id', role: 'owner', bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_applications'] },
    }

    const { rows } = await readCsv(await GET(request()))

    expect(rows.map((row) => row.Résidence)).toEqual(['Résidence A', 'Total'])
    expect(rows[1]['Demandes reçues']).toBe('1')
  })

  it('refuse un administrateur plateforme non rattaché au bailleur visé', async () => {
    await createUser({ id: 'admin-id', role: 'admin', email: 'admin@test.com', name: 'Admin' })
    mockSession.current = { user: { id: 'admin-id', role: 'admin' } }
    expect((await GET(request(`period=30d&ownerId=${ownerId}`))).status).toBe(403)
  })

  it('laisse un administrateur plateforme rattaché extraire le bailleur', async () => {
    await createUser({ id: 'admin-id', role: 'admin', email: 'admin@test.com', name: 'Admin' })
    await createAdminOwnerLink({ userId: 'admin-id', ownerId })
    mockSession.current = { user: { id: 'admin-id', role: 'admin' } }
    const { rows } = await readCsv(await GET(request(`period=30d&ownerId=${ownerId}`)))
    expect(rows.map((row) => row.Résidence)).toEqual(['Résidence A', 'Résidence B', 'Total'])
  })

  it('ne renvoie que l’en-tête et le total en mode aucun', async () => {
    await getTestDb()
      .update((await import('../server/db/schema/owners')).owners)
      .set({ contactMode: EOwnerContactMode.NONE })
    const { rows } = await readCsv(await GET(request()))
    expect(rows.map((row) => row.Résidence)).toEqual(['Total'])
  })

  it('rejette un ownerId invalide', async () => {
    expect((await GET(request('period=30d&ownerId=abc'))).status).toBe(400)
  })
})
