import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAcademy,
  createAccommodation,
  createAdminOwnerLink,
  createCity,
  createDepartment,
  createFavoriteAccommodation,
  createOwner,
  createTrackingEvent,
  createUser,
} from './fixtures/factories'
import './helpers/setup-integration'

const mockSession = vi.hoisted(() => ({
  current: null as null | { user: { id: string; role: 'admin' | 'owner' | 'user' } },
}))

vi.mock('~/services/better-auth', () => ({
  getServerSession: vi.fn(() => mockSession.current),
}))

import { GET } from '~/app/api/bailleur/statistiques/export/route'

const request = (query = 'period=30d') => new NextRequest(`http://localhost/api/bailleur/statistiques/export?${query}`)

/** Découpe le CSV en en-têtes + lignes indexées par nom de colonne. BOM retiré. */
async function readCsv(response: Response) {
  const [headerLine, ...rows] = (await response.text()).replace(/^﻿/, '').split('\n')
  const headers = headerLine.split(';')
  return {
    headers,
    rows: rows.map((line) => Object.fromEntries(line.split(';').map((value, index) => [headers[index], value]))),
  }
}

async function createCityWithDeps(name: string, slug: string) {
  const academy = await createAcademy({ name: `Académie ${slug}` })
  const department = await createDepartment({ name: `Département ${slug}`, academyId: academy.id })
  return createCity({ name, slug, departmentId: department.id })
}

async function setupOwnerWithStats() {
  await createUser({ id: 'gest-id', role: 'owner', email: 'gest@bailleur.fr', name: 'Gestionnaire' })
  const owner = await createOwner({ name: 'Bailleur Stats', slug: 'bailleur-stats', userId: 'gest-id' })
  const city = await createCityWithDeps('Lyon', 'lyon')
  const accommodation = await createAccommodation({ slug: 'res-a', name: 'Résidence A', ownerId: owner.id, cityId: city.id })

  await createTrackingEvent({ type: 'accommodation.viewed', ownerId: owner.id, accommodationId: accommodation.id })
  await createTrackingEvent({ type: 'accommodation.viewed', ownerId: owner.id, accommodationId: accommodation.id })
  await createTrackingEvent({ type: 'accommodation.consult_offer', ownerId: owner.id, accommodationId: accommodation.id })
  await createFavoriteAccommodation({ userId: 'favoriter-1', accommodationId: accommodation.id })

  return { owner, city, accommodation }
}

beforeEach(() => {
  mockSession.current = { user: { id: 'gest-id', role: 'owner' } }
})

describe('GET /api/bailleur/statistiques/export', () => {
  it('refuse un visiteur non connecté', async () => {
    mockSession.current = null

    expect((await GET(request())).status).toBe(401)
  })

  it('refuse un étudiant connecté', async () => {
    await createUser({ id: 'student-id', role: 'user', email: 'student@test.com', name: 'Étudiant' })
    mockSession.current = { user: { id: 'student-id', role: 'user' } }

    expect((await GET(request())).status).toBe(403)
  })

  it('refuse un gestionnaire sans fiche rattachée', async () => {
    await createUser({ id: 'orphan-id', role: 'owner', email: 'orphan@test.com', name: 'Orphelin' })
    mockSession.current = { user: { id: 'orphan-id', role: 'owner' } }

    expect((await GET(request())).status).toBe(403)
  })

  it('rejette une période inconnue', async () => {
    await setupOwnerWithStats()

    expect((await GET(request('period=42d'))).status).toBe(400)
  })

  it('renvoie un CSV nommé d’après le gestionnaire et la période', async () => {
    await setupOwnerWithStats()

    const response = await GET(request('period=7d'))

    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('Content-Disposition')).toContain('statistiques-bailleur-stats-7d-')
  })

  it('compte vues, consultations et favoris pour chaque résidence', async () => {
    const { owner, city } = await setupOwnerWithStats()
    await createAccommodation({ slug: 'res-b', name: 'Résidence B', ownerId: owner.id, cityId: city.id })

    const { headers, rows } = await readCsv(await GET(request()))

    expect(headers).toEqual([
      'Résidence',
      'Ville',
      'Code postal',
      'Publiée',
      'Vues de la fiche',
      "Consultations de l'offre",
      'Mises en favori',
      'Début de période',
      'Fin de période',
    ])

    // Toutes les résidences du parc sont extraites, pas seulement la page affichée.
    expect(rows).toHaveLength(2)
    const residenceA = rows.find((row) => row.Résidence === 'Résidence A')
    expect(residenceA?.['Vues de la fiche']).toBe('2')
    expect(residenceA?.["Consultations de l'offre"]).toBe('1')
    expect(residenceA?.['Mises en favori']).toBe('1')
    expect(residenceA?.Ville).toBe('Lyon')

    const residenceB = rows.find((row) => row.Résidence === 'Résidence B')
    expect(residenceB?.['Vues de la fiche']).toBe('0')
  })

  it('n’expose que les résidences du gestionnaire connecté', async () => {
    await setupOwnerWithStats()
    await createUser({ id: 'autre-id', role: 'owner', email: 'autre@bailleur.fr', name: 'Autre' })
    const autreOwner = await createOwner({ name: 'Autre Bailleur', slug: 'autre-bailleur', userId: 'autre-id' })
    const autreCity = await createCityWithDeps('Paris', 'paris')
    await createAccommodation({ slug: 'res-autre', name: 'Résidence Autre', ownerId: autreOwner.id, cityId: autreCity.id })

    const { rows } = await readCsv(await GET(request()))

    expect(rows.map((row) => row.Résidence)).toEqual(['Résidence A'])
  })

  it('ignore un ownerId forgé par un gestionnaire visant le parc d’un autre', async () => {
    await setupOwnerWithStats()
    await createUser({ id: 'autre-id', role: 'owner', email: 'autre@bailleur.fr', name: 'Autre' })
    const autreOwner = await createOwner({ name: 'Autre Bailleur', slug: 'autre-bailleur', userId: 'autre-id' })
    const autreCity = await createCityWithDeps('Paris', 'paris')
    await createAccommodation({ slug: 'res-autre', name: 'Résidence Autre', ownerId: autreOwner.id, cityId: autreCity.id })

    // Le gestionnaire connecté reste rattaché à sa propre fiche : le paramètre est sans effet pour lui.
    const response = await GET(request(`period=30d&ownerId=${autreOwner.id}`))
    const { rows } = await readCsv(response)

    expect(response.headers.get('Content-Disposition')).toContain('statistiques-bailleur-stats-')
    expect(rows.map((row) => row.Résidence)).toEqual(['Résidence A'])
  })

  it('refuse un administrateur non rattaché au gestionnaire visé', async () => {
    const { owner } = await setupOwnerWithStats()
    await createUser({ id: 'admin-id', role: 'admin', email: 'admin@test.com', name: 'Admin' })
    mockSession.current = { user: { id: 'admin-id', role: 'admin' } }

    // Sans lien admin ↔ gestionnaire ni fiche propre, il ne reste aucun parc à extraire.
    expect((await GET(request(`period=30d&ownerId=${owner.id}`))).status).toBe(403)
  })

  it('laisse un administrateur extraire un gestionnaire auquel il est rattaché', async () => {
    const { owner } = await setupOwnerWithStats()
    await createUser({ id: 'admin-id', role: 'admin', email: 'admin@test.com', name: 'Admin' })
    await createAdminOwnerLink({ userId: 'admin-id', ownerId: owner.id })
    mockSession.current = { user: { id: 'admin-id', role: 'admin' } }

    const { rows } = await readCsv(await GET(request(`period=30d&ownerId=${owner.id}`)))

    expect(rows.map((row) => row.Résidence)).toEqual(['Résidence A'])
  })
})
