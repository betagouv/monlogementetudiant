import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { typologyDraft } from '~/server/lib/typologies'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import './helpers/setup-integration'

const mockSession = vi.hoisted(() => ({
  current: null as null | { user: { role: 'admin' | 'owner' | 'user' } },
}))

vi.mock('~/services/better-auth', () => ({
  getServerSession: vi.fn(() => mockSession.current),
}))

import { GET } from '~/app/api/admin/residences/export/route'
import { gestionnaireCallerFactory } from './helpers/test-caller'

const request = () => new NextRequest('http://localhost/api/admin/residences/export')

/** Découpe le CSV en en-têtes + lignes indexées par nom de colonne. BOM retiré. */
async function readCsv(response: Response) {
  const [headerLine, ...rows] = (await response.text()).replace(/^﻿/, '').split('\n')
  const headers = headerLine.split(';')
  return {
    headers,
    rows: rows.map((line) => Object.fromEntries(line.split(';').map((value, index) => [headers[index], value]))),
  }
}

beforeEach(async () => {
  mockSession.current = { user: { role: 'admin' } }
  await createUser({ id: 'test-gestionnaire-id', name: 'Gestionnaire', email: 'gest@test.com', role: 'owner', firstname: 'Léa', lastname: 'Martin' })
})

describe('GET /api/admin/residences/export', () => {
  it('refuse un visiteur non administrateur', async () => {
    mockSession.current = { user: { role: 'owner' } }

    const response = await GET(request())

    expect(response.status).toBe(401)
  })

  it("expose la date et l'auteur de la dernière mise à jour des disponibilités", async () => {
    const owner = await createOwner({ name: 'Bailleur Export', slug: 'bailleur-export', userId: 'test-gestionnaire-id' })
    await createAccommodation({ name: 'Résidence Export', slug: 'residence-export', ownerId: owner.id }, [
      typologyDraft('t1', { nbTotal: 10, nbAvailable: 2 }),
    ])

    const caller = gestionnaireCallerFactory({ permissions: ['manage_availability'] })
    await caller.bailleur.updateAvailability({ slug: 'residence-export', availability: [{ type: 't1', nbAvailable: 5 }] })

    const { headers, rows } = await readCsv(await GET(request()))

    // Les colonnes se lisent à côté de `updatedAt`, pas reléguées en fin de fichier.
    expect(headers.indexOf('availabilityUpdatedAt')).toBe(headers.indexOf('updatedAt') + 1)
    expect(headers).toContain('availabilityUpdatedBy')

    const row = rows.find((r) => r.slug === 'residence-export')
    expect(row?.availabilityUpdatedBy).toBe('Test Gestionnaire')
    expect(new Date(row!.availabilityUpdatedAt).getTime()).toBeGreaterThan(Date.now() - 60_000)
  })

  it('laisse les colonnes vides pour une résidence dont les dispos n’ont jamais été touchées', async () => {
    const owner = await createOwner({ name: 'Bailleur Muet', slug: 'bailleur-muet' })
    await createAccommodation({ name: 'Résidence Muette', slug: 'residence-muette', ownerId: owner.id }, [
      typologyDraft('t1', { nbTotal: 4 }),
    ])

    const { rows } = await readCsv(await GET(request()))

    const row = rows.find((r) => r.slug === 'residence-muette')
    expect(row?.availabilityUpdatedAt).toBe('')
    expect(row?.availabilityUpdatedBy).toBe('')
  })

  it('retient aussi une dispo modifiée via le formulaire complet de la résidence', async () => {
    const owner = await createOwner({ name: 'Bailleur Form', slug: 'bailleur-form', userId: 'test-gestionnaire-id' })
    await createAccommodation({ name: 'Résidence Form', slug: 'residence-form', ownerId: owner.id }, [
      typologyDraft('t1', { nbTotal: 10, nbAvailable: 1 }),
    ])

    const caller = gestionnaireCallerFactory({ permissions: ['manage_residences'] })
    await caller.bailleur.update({
      slug: 'residence-form',
      typologies: [{ type: 't1', nbTotal: 10, nbAvailable: 7, colocation: false }],
    })

    const { rows } = await readCsv(await GET(request()))

    const row = rows.find((r) => r.slug === 'residence-form')
    expect(row?.availabilityUpdatedBy).toBe('Test Gestionnaire')
  })
})
