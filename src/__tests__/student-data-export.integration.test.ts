import { beforeEach, describe, expect, it } from 'vitest'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { budgetSimulations, contactRequests, studentGoalLists, studentGoals, supportTickets } from '~/server/db/schema'
import { collectStudentData } from '~/server/users/export-data'
import { typologyDraft } from '../server/lib/typologies'
import {
  createAccommodation,
  createAlert,
  createDossierFacileApplication,
  createDossierFacileDocument,
  createDossierFacileTenant,
  createFavoriteAccommodation,
  createOwner,
  createUser,
} from './fixtures/factories'
import './helpers/setup-integration'
import { getTestDb } from './helpers/test-db'

beforeEach(async () => {
  await createUser({
    id: 'export-student',
    name: 'Camille Export',
    email: 'export@test.com',
    firstname: 'Camille',
    lastname: 'Export',
    phone: '0601020304',
    role: 'user',
  })
})

describe('collectStudentData', () => {
  it('rassemble toutes les données de l’étudiant, avec les noms joints plutôt que les ids', async () => {
    const db = getTestDb()
    const owner = await createOwner({ name: 'Owner Export', slug: 'owner-export', contactMode: EOwnerContactMode.CONTACTS })
    const accommodation = await createAccommodation({ name: 'Résidence Export', slug: 'res-export', ownerId: owner!.id }, [
      typologyDraft('t1', { nbAvailable: 1 }),
    ])

    await db.insert(contactRequests).values({
      userId: 'export-student',
      accommodationId: accommodation.id,
      firstname: 'Camille',
      lastname: 'Export',
      email: 'export@test.com',
      apartmentType: 't1',
      confirmedAt: new Date(),
    })
    const tenant = await createDossierFacileTenant({ userId: 'export-student', name: 'Camille Export' })
    await createDossierFacileDocument({ tenantId: tenant!.id })
    await createDossierFacileApplication({ tenantId: tenant!.id, accommodationSlug: 'res-export', apartmentType: 't1' })
    await createAlert({ userId: 'export-student', name: 'Alerte Lyon', maxPrice: 650 })
    await createFavoriteAccommodation({ userId: 'export-student', accommodationId: accommodation.id })
    await db.insert(budgetSimulations).values({ userId: 'export-student', inputs: {} as never })
    const [list] = await db.insert(studentGoalLists).values({ userId: 'export-student' }).returning()
    await db.insert(studentGoals).values({ listId: list.id, title: 'Préparer mon dossier', dueDelay: 'one_week', dueAt: new Date() })
    await db.insert(supportTickets).values({ userId: 'export-student', category: 'account', message: 'Question sur mon compte' })

    const data = await collectStudentData('export-student')

    expect(data).not.toBeNull()
    expect(data!.profil.email).toBe('export@test.com')
    expect(data!.profil.firstname).toBe('Camille')
    expect(data!.candidatures).toEqual([expect.objectContaining({ residence: 'Résidence Export', typeDeLogement: 't1' })])
    expect(data!.dossierFacile).toMatchObject({ nom: 'Camille Export', nombreDeGarants: null })
    expect(data!.dossierFacile!.documents).toHaveLength(1)
    expect(data!.dossierFacile!.candidatures).toEqual([expect.objectContaining({ residence: 'res-export' })])
    expect(data!.alertes).toEqual([expect.objectContaining({ nom: 'Alerte Lyon', budgetMax: 650 })])
    expect(data!.favoris).toEqual([expect.objectContaining({ residence: 'Résidence Export' })])
    expect(data!.simulationsBudget).toHaveLength(1)
    expect(data!.listesObjectifs).toEqual([
      expect.objectContaining({ objectifs: [expect.objectContaining({ titre: 'Préparer mon dossier' })] }),
    ])
    expect(data!.ticketsSupport).toEqual([expect.objectContaining({ message: 'Question sur mon compte' })])

    // Aucune donnée technique interne ne doit fuiter dans l'export.
    const serialized = JSON.stringify(data)
    expect(serialized).not.toContain('ipHash')
    expect(serialized).not.toContain('"userId"')
  })

  it('retourne des sections vides pour un compte sans activité', async () => {
    const data = await collectStudentData('export-student')

    expect(data).not.toBeNull()
    expect(data!.candidatures).toEqual([])
    expect(data!.dossierFacile).toBeNull()
    expect(data!.alertes).toEqual([])
    expect(data!.favoris).toEqual([])
    expect(data!.listesObjectifs).toEqual([])
  })

  it('retourne null pour un compte inconnu', async () => {
    expect(await collectStudentData('does-not-exist')).toBeNull()
  })
})
