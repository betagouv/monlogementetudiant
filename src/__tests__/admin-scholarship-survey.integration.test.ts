import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scholarshipSurveyAnswers, scholarshipSurveyOwners } from '../server/db/schema/scholarship-survey'
import { createAccommodation, createExternalSource, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { adminCaller, ownerCaller } from './helpers/test-caller'

const mockSession = vi.hoisted(() => ({ current: null as null | { user: { id: string; role: 'admin' | 'owner' | 'user' } } }))

vi.mock('~/services/better-auth', async () => {
  const actual = await vi.importActual<typeof import('~/services/better-auth')>('~/services/better-auth')
  return { ...actual, getServerSession: vi.fn(() => mockSession.current) }
})

import { GET } from '~/app/api/admin/enquete-boursiers/export/route'

const request = (query = '') => new NextRequest(`http://localhost/api/admin/enquete-boursiers/export?${query}`)

async function readCsv(response: Response) {
  const [headerLine, ...rows] = (await response.text()).replace(/^﻿/, '').split('\n')
  return { headerLine, rows }
}

let answered: { id: number }
let unanswered: { id: number }

beforeEach(async () => {
  mockSession.current = { user: { id: 'test-admin-id', role: 'admin' } }
  const db = getTestDb()
  await createUser({ id: 'test-admin-id', name: 'Admin', email: 'admin@test.com', role: 'admin' })

  const ownerA = await createOwner({ name: 'Bailleur A', slug: 'bailleur-a' })
  const ownerB = await createOwner({ name: 'Bailleur B', slug: 'bailleur-b' })
  const crousOwner = await createOwner({ name: 'CROUS', slug: 'crous' })

  answered = await createAccommodation({ slug: 'res-answered', name: 'Résidence répondue', ownerId: ownerA.id })
  unanswered = await createAccommodation({ slug: 'res-unanswered', name: 'Résidence sans réponse', ownerId: ownerB.id })
  await createAccommodation({ slug: 'res-draft', name: 'Brouillon', ownerId: ownerB.id, published: false })
  const crous = await createAccommodation({ slug: 'res-crous', name: 'Cité U', ownerId: crousOwner.id })
  await createExternalSource({ accommodationId: crous.id, source: 'crous', sourceId: 'c-1' })

  await db.insert(scholarshipSurveyAnswers).values({ accommodationId: answered.id, scholarshipCount: 42, scholarshipRate: 12 })
  await db.insert(scholarshipSurveyOwners).values({ ownerId: ownerA.id })
})

describe('admin.scholarshipSurvey.list', () => {
  it('exclut les résidences CROUS et non publiées', async () => {
    const { rows, total } = await adminCaller.admin.scholarshipSurvey.list({ status: 'all', page: 1 })
    expect(total).toBe(2)
    expect(rows.map((r) => r.accommodationName).sort()).toEqual(['Résidence répondue', 'Résidence sans réponse'])
  })

  it('filtre les résidences sans réponse', async () => {
    const { rows } = await adminCaller.admin.scholarshipSurvey.list({ status: 'unanswered', page: 1 })
    expect(rows.map((r) => r.accommodationId)).toEqual([unanswered.id])
  })

  it('filtre les résidences répondues', async () => {
    const { rows } = await adminCaller.admin.scholarshipSurvey.list({ status: 'answered', page: 1 })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ accommodationId: answered.id, scholarshipCount: 42, scholarshipRate: 12, ownerName: 'Bailleur A' })
    expect(rows[0].ownerCompletedAt).toBeInstanceOf(Date)
  })

  it('est réservée aux admins', async () => {
    await expect(ownerCaller.admin.scholarshipSurvey.list({ status: 'all', page: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('admin.scholarshipSurvey.stats', () => {
  it('compte les bailleurs et résidences du périmètre', async () => {
    expect(await adminCaller.admin.scholarshipSurvey.stats()).toEqual({
      ownersCompleted: 1,
      ownersTotal: 2,
      residencesFilled: 1,
      residencesTotal: 2,
    })
  })
})

describe('GET /api/admin/enquete-boursiers/export', () => {
  it('refuse un non-admin', async () => {
    mockSession.current = { user: { id: 'owner', role: 'owner' } }
    expect((await GET(request())).status).toBe(401)
  })

  it('exporte les colonnes attendues en respectant le filtre', async () => {
    const response = await GET(request('status=unanswered'))
    expect(response.status).toBe(200)
    const { headerLine, rows } = await readCsv(response)
    expect(headerLine).toBe(
      'Bailleur;Résidence;Ville;Nombre de boursiers;Part de boursiers (%);Non mesuré;Dernière mise à jour;Auteur;Enquête bailleur complétée le',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain('Résidence sans réponse')
  })
})
