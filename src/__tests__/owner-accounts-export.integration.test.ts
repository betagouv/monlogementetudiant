import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { user } from '~/server/db/schema/auth'
import { createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const mockSession = vi.hoisted(() => ({
  current: null as null | { user: { role: 'admin' | 'owner' | 'user' } },
}))

vi.mock('~/services/better-auth', () => ({
  getServerSession: vi.fn(() => mockSession.current),
}))

import { GET } from '~/app/api/admin/comptes-gestionnaires/export/route'

/** Decoupe le CSV en en-tetes + lignes indexees par nom de colonne. BOM retire. */
async function readCsv(response: Response) {
  const [headerLine, ...rows] = (await response.text()).replace(/^﻿/, '').split('\n')
  const headers = headerLine.split(';')
  return {
    headers,
    rows: rows.map((line) => Object.fromEntries(line.split(';').map((value, index) => [headers[index], value]))),
  }
}

/** Cree un compte rattache au bailleur donne, avec le role bailleur voulu. */
async function createOwnerAccount(id: string, ownerId: number, bailleurRole: 'administrator' | 'gestionnaire' | null) {
  const db = getTestDb()
  await createUser({ id, name: id, email: `${id}@test.fr`, firstname: id, lastname: id, role: bailleurRole === null ? 'user' : 'owner' })
  await db.update(user).set({ ownerId, bailleurRole }).where(eq(user.id, id))
}

beforeEach(async () => {
  mockSession.current = { user: { role: 'admin' } }

  // Trois bailleurs volontairement crees dans le desordre alphabetique.
  const zebre = await createOwner({ name: 'Zebre Habitat', slug: 'zebre-habitat' })
  const alpha = await createOwner({ name: 'Alpha Logement', slug: 'alpha-logement' })
  const medium = await createOwner({ name: 'Medium Foyer', slug: 'medium-foyer' })

  await createOwnerAccount('zebre-admin', zebre.id, 'administrator')
  await createOwnerAccount('zebre-gest', zebre.id, 'gestionnaire')
  await createOwnerAccount('alpha-admin', alpha.id, 'administrator')
  await createOwnerAccount('alpha-gest', alpha.id, 'gestionnaire')
  await createOwnerAccount('medium-gest', medium.id, 'gestionnaire')
  await createOwnerAccount('medium-sans-role', medium.id, null)
})

describe('export CSV des comptes gestionnaires', () => {
  it('refuse un appelant non admin', async () => {
    mockSession.current = { user: { role: 'owner' } }
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('expose une colonne role lisible', async () => {
    const { headers, rows } = await readCsv(await GET())

    expect(headers).toEqual(['prenom', 'nom', 'email', 'nom_gestionnaire', 'role'])
    expect(rows.find((r) => r.email === 'alpha-admin@test.fr')?.role).toBe('Administrateur')
    expect(rows.find((r) => r.email === 'alpha-gest@test.fr')?.role).toBe('Gestionnaire')
  })

  it('remonte tous les administrateurs avant les autres comptes', async () => {
    const { rows } = await readCsv(await GET())

    const roles = rows.map((r) => r.role)
    const dernierAdmin = roles.lastIndexOf('Administrateur')
    const premierNonAdmin = roles.findIndex((r) => r !== 'Administrateur')

    expect(dernierAdmin).toBeGreaterThanOrEqual(0)
    expect(premierNonAdmin).toBeGreaterThan(dernierAdmin)
  })

  it('classe chaque bloc par ordre alphabetique de bailleur', async () => {
    const { rows } = await readCsv(await GET())

    const admins = rows.filter((r) => r.role === 'Administrateur').map((r) => r.nom_gestionnaire)
    const autres = rows.filter((r) => r.role !== 'Administrateur').map((r) => r.nom_gestionnaire)

    expect(admins).toEqual([...admins].sort((a, b) => a.localeCompare(b)))
    expect(autres).toEqual([...autres].sort((a, b) => a.localeCompare(b)))
    // Le bloc admin repart de A : ce n'est pas un tri global par bailleur.
    expect(admins[0]).toBe('Alpha Logement')
    expect(autres[0]).toBe('Alpha Logement')
  })

  it('conserve les comptes rattaches a un bailleur sans role bailleur', async () => {
    const { rows } = await readCsv(await GET())

    const sansRole = rows.find((r) => r.email === 'medium-sans-role@test.fr')
    expect(sansRole).toBeDefined()
    expect(sansRole?.role).toBe('')
  })
})
