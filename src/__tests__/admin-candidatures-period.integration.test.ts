import { format } from 'date-fns'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EContactStatus } from '~/enums/contact-status'
import { contactRequests } from '~/server/db/schema'
import {
  createAccommodation,
  createDossierFacileApplication,
  createDossierFacileTenant,
  createOwner,
  createUser,
} from './fixtures/factories'
import { adminCaller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const mockSession = vi.hoisted(() => ({
  current: null as null | { user: { role: 'admin' | 'owner' | 'user' } },
}))

vi.mock('~/services/better-auth', () => ({
  getServerSession: vi.fn(() => mockSession.current),
}))

import { NextRequest } from 'next/server'
import { GET } from '~/app/api/admin/candidatures/export/route'

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS)
const isoDaysAgo = (days: number) => format(daysAgo(days), 'yyyy-MM-dd')

const last30Days = { from: isoDaysAgo(30), to: isoDaysAgo(0) }
const from90To40DaysAgo = { from: isoDaysAgo(90), to: isoDaysAgo(40) }

async function readCsv(response: Response) {
  const [headerLine, ...rows] = (await response.text()).replace(/^﻿/, '').split('\n')
  const headers = headerLine.split(';')
  return rows.map((line) => Object.fromEntries(line.split(';').map((value, index) => [headers[index], value])))
}

const exportRequest = (params: Record<string, string>) =>
  new NextRequest(`http://localhost/api/admin/candidatures/export?${new URLSearchParams(params).toString()}`)

/**
 * Récente : demande visiteur boursière. Ancienne (60 j) : demande anonymisée d'un étudiant connecté,
 * boursier d'après son profil, et demande visiteur anonymisée, sans statut. DossierFacile récente,
 * étudiant non boursier.
 */
async function seed() {
  const db = getTestDb()
  const owner = await createOwner({ name: 'Bailleur Période', slug: 'bailleur-periode' })
  const recent = await createAccommodation({ name: 'Résidence Récente', slug: 'residence-recente', ownerId: owner.id })
  const old = await createAccommodation({ name: 'Résidence Ancienne', slug: 'residence-ancienne', ownerId: owner.id })

  await createUser({ id: 'student-scholar', email: 'boursier@test.fr', scholarshipStatus: 'yes' })
  await createUser({ id: 'student-df', email: 'df@test.fr', scholarshipStatus: 'no' })

  await db.insert(contactRequests).values([
    {
      accommodationId: recent.id,
      email: 'visiteur@test.fr',
      scholarshipStatus: 'yes',
      confirmedAt: daysAgo(2),
      apartmentType: 't1',
      createdAt: daysAgo(2),
    },
    {
      accommodationId: old.id,
      userId: 'student-scholar',
      anonymizedAt: daysAgo(20),
      status: EContactStatus.CONTACTE,
      createdAt: daysAgo(60),
    },
    {
      accommodationId: old.id,
      confirmedAt: daysAgo(60),
      anonymizedAt: daysAgo(20),
      createdAt: daysAgo(60),
    },
  ])

  const tenant = await createDossierFacileTenant({ userId: 'student-df' })
  await createDossierFacileApplication({
    tenantId: tenant.id,
    accommodationSlug: recent.slug,
    apartmentType: 't2',
    createdAt: daysAgo(5),
  })
}

beforeEach(() => {
  mockSession.current = { user: { role: 'admin' } }
})

describe('admin.candidatures sur une période', () => {
  it('ne compte que les candidatures déposées dans la période', async () => {
    await seed()

    const recent = await adminCaller.admin.candidatures.overview(last30Days)
    const old = await adminCaller.admin.candidatures.overview(from90To40DaysAgo)

    expect(recent).toMatchObject({ total: 2, contact: 1, dossierFacile: 1, residences: 1 })
    expect(old).toMatchObject({ total: 2, contact: 2, dossierFacile: 0, residences: 1, active: 0 })
  })

  it('retombe sur le profil pour le statut boursier d’une demande anonymisée', async () => {
    await seed()

    const recent = await adminCaller.admin.candidatures.overview(last30Days)
    const old = await adminCaller.admin.candidatures.overview(from90To40DaysAgo)

    expect(recent.scholarship).toEqual({ yes: 1, no: 1, unknown: 0, missing: 0 })
    expect(old.scholarship).toEqual({ yes: 1, no: 0, unknown: 0, missing: 1 })
  })

  it('liste les résidences avec leurs volumes sur la période', async () => {
    await seed()

    const { items } = await adminCaller.admin.candidatures.list({ ...from90To40DaysAgo, page: 1 })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ name: 'Résidence Ancienne', contactCount: 2, dossierFacileCount: 0, scholarshipHolderCount: 1 })
  })

  it('refuse une période dont la fin précède le début', async () => {
    await expect(adminCaller.admin.candidatures.overview({ from: isoDaysAgo(0), to: isoDaysAgo(10) })).rejects.toThrow()
  })
})

describe('GET /api/admin/candidatures/export', () => {
  it('refuse un visiteur non administrateur', async () => {
    mockSession.current = { user: { role: 'owner' } }

    const response = await GET(exportRequest(last30Days))

    expect(response.status).toBe(401)
  })

  it('refuse une période absente ou invalide', async () => {
    const response = await GET(exportRequest({ from: 'hier' }))

    expect(response.status).toBe(400)
  })

  it('exporte une ligne par candidature de la période, sans coordonnées', async () => {
    await seed()

    const response = await GET(exportRequest(last30Days))
    const rows = await readCsv(response)

    expect(response.headers.get('Content-Disposition')).toContain(`candidatures-${last30Days.from}-${last30Days.to}.csv`)
    expect(rows).toEqual([
      {
        date: isoDaysAgo(2),
        residence: 'Résidence Récente',
        ville: expect.stringMatching(/^Ville Test/),
        gestionnaire: 'Bailleur Période',
        canal: 'Coordonnées',
        statut: 'À contacter',
        type_logement: 'T1 (Studio)',
        boursier: 'Oui',
        compte: 'Visiteur',
      },
      {
        date: isoDaysAgo(5),
        residence: 'Résidence Récente',
        ville: expect.stringMatching(/^Ville Test/),
        gestionnaire: 'Bailleur Période',
        canal: 'DossierFacile',
        statut: 'À modérer',
        type_logement: 'T2',
        boursier: 'Non',
        compte: 'Étudiant connecté',
      },
    ])
  })

  it('exporte le statut boursier du profil, ou « Non renseigné », pour les demandes anonymisées', async () => {
    await seed()

    const rows = await readCsv(await GET(exportRequest(from90To40DaysAgo)))

    expect(rows.map((row) => [row.compte, row.boursier])).toEqual(
      expect.arrayContaining([
        ['Étudiant connecté', 'Oui'],
        ['Visiteur', 'Non renseigné'],
      ]),
    )
    expect(rows).toHaveLength(2)
  })
})
