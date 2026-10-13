import { inArray } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EContactStatus } from '~/enums/contact-status'
import { ELoginAttemptStatus } from '~/enums/login-attempt-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { activityLog, bailleurAccommodationScopes, contactRequests, loginAttempts } from '~/server/db/schema'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const mockSession = vi.hoisted(() => ({
  current: null as null | { user: { role: 'admin' | 'owner' | 'user' } },
}))

vi.mock('~/services/better-auth', () => ({
  getServerSession: vi.fn(() => mockSession.current),
}))

import { GET } from '~/app/api/admin/residences/suivi-coordonnees/export/route'

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS)
const frDate = (date: Date) => date.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })

async function readCsv(response: Response) {
  const [headerLine, ...rows] = (await response.text()).replace(/^﻿/, '').split('\n')
  const headers = headerLine.split(';')
  return rows.map((line) => Object.fromEntries(line.split(';').map((value, index) => [headers[index], value])))
}

beforeEach(async () => {
  mockSession.current = { user: { role: 'admin' } }
  await getTestDb()
    .delete(activityLog)
    .where(inArray(activityLog.action, ['owner.contact_mode_updated', 'accommodation.applications_resumed']))
})

describe('GET /api/admin/residences/suivi-coordonnees/export', () => {
  it('refuse un visiteur non administrateur', async () => {
    mockSession.current = { user: { role: 'owner' } }

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('agrège par résidence les ayants droit, l’activation et le traitement des coordonnées', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Bailleur Suivi', slug: 'bailleur-suivi', contactMode: EOwnerContactMode.CONTACTS })
    const open = await createAccommodation({ name: 'Résidence Ouverte', slug: 'residence-ouverte', ownerId: owner.id })
    const suspended = await createAccommodation({
      name: 'Résidence Suspendue',
      slug: 'residence-suspendue',
      ownerId: owner.id,
      applicationsSuspendedAt: daysAgo(1),
    })

    await createUser({
      id: 'admin-bailleur',
      email: 'admin@suivi.fr',
      role: 'owner',
      firstname: 'Alice',
      lastname: 'Admin',
      ownerId: owner.id,
      bailleurRole: 'administrator',
    })
    await createUser({
      id: 'gestionnaire-restreint',
      email: 'restreint@suivi.fr',
      role: 'owner',
      firstname: 'Rémi',
      lastname: 'Restreint',
      ownerId: owner.id,
      bailleurRole: 'gestionnaire',
      bailleurPermissions: ['manage_applications'],
      applicationScopeRestricted: true,
    })
    await createUser({
      id: 'gestionnaire-residences',
      email: 'residences@suivi.fr',
      role: 'owner',
      ownerId: owner.id,
      bailleurRole: 'gestionnaire',
      bailleurPermissions: ['manage_residences'],
    })
    await db.insert(bailleurAccommodationScopes).values({ userId: 'gestionnaire-restreint', accommodationId: suspended.id })

    const gestionnaireLogin = daysAgo(3)
    await db.insert(loginAttempts).values([
      {
        userId: 'admin-bailleur',
        ownerId: owner.id,
        role: 'owner',
        tokenHash: 'a',
        expiresAt: daysAgo(-1),
        status: ELoginAttemptStatus.COMPLETED,
        verifiedAt: daysAgo(10),
      },
      {
        userId: 'gestionnaire-restreint',
        ownerId: owner.id,
        role: 'owner',
        tokenHash: 'b',
        expiresAt: daysAgo(-1),
        status: ELoginAttemptStatus.COMPLETED,
        verifiedAt: gestionnaireLogin,
      },
    ])

    const activatedAt = daysAgo(45)
    await db.insert(activityLog).values({
      action: 'owner.contact_mode_updated',
      entityType: 'owner',
      entityId: String(owner.id),
      ownerId: owner.id,
      createdAt: activatedAt,
      metadata: { diff: { contactMode: { old: EOwnerContactMode.NONE, new: EOwnerContactMode.CONTACTS } } },
    })

    const reviewedAt = daysAgo(2)
    const lastReceived = daysAgo(5)
    await db.insert(contactRequests).values([
      {
        accommodationId: open.id,
        email: 'traite@x.fr',
        confirmedAt: daysAgo(8),
        createdAt: daysAgo(8),
        status: EContactStatus.CONTACTE,
        reviewedAt,
      },
      { accommodationId: open.id, email: 'attente@x.fr', confirmedAt: lastReceived, createdAt: lastReceived },
      { accommodationId: open.id, email: 'expire@x.fr', confirmedAt: daysAgo(40), createdAt: daysAgo(40) },
      { accommodationId: open.id, email: 'non-confirme@x.fr', createdAt: daysAgo(1) },
    ])

    const rows = await readCsv(await GET())
    const openRow = rows.find((row) => row['Résidence'] === 'Résidence Ouverte')
    const suspendedRow = rows.find((row) => row['Résidence'] === 'Résidence Suspendue')

    expect(openRow).toMatchObject({
      ID: String(open.id),
      Gestionnaire: 'Bailleur Suivi',
      'Administrateurs (nom et email)': 'Alice Admin <admin@suivi.fr>',
      'Dernière connexion d’un administrateur': frDate(daysAgo(10)),
      'Dépôt de coordonnées activé': 'oui',
      'Date d’activation du dépôt': frDate(activatedAt),
      'Coordonnées reçues': '3',
      'Dernière réception': frDate(lastReceived),
      'Coordonnées traitées': '1',
      'Dernier changement de statut': frDate(reviewedAt),
      'En attente de traitement': '1',
      'Expirées sans traitement': '1',
    })
    expect(suspendedRow).toMatchObject({
      'Administrateurs (nom et email)': 'Alice Admin <admin@suivi.fr>, Rémi Restreint <restreint@suivi.fr>',
      'Dernière connexion d’un administrateur': frDate(gestionnaireLogin),
      'Dépôt de coordonnées activé': 'non',
      'Date d’activation du dépôt': '',
      'Coordonnées reçues': '0',
    })
  })
})
