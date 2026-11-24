import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { CONTACT_RETENTION_DAYS, EContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { getBailleurContactsExport } from '~/server/exports/bailleur-contacts'
import { accommodations } from '../server/db/schema/accommodations'
import { user } from '../server/db/schema/auth'
import { bailleurAccommodationScopes } from '../server/db/schema/bailleur-accommodation-scopes'
import { contactRequests } from '../server/db/schema/contacts'
import {
  createAcademy,
  createAccommodation,
  createCity,
  createDepartment,
  createDossierFacileApplication,
  createDossierFacileTenant,
  createOwner,
  createUser,
} from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS)

let ownerId: number
let resA: { id: number; slug: string }
let resB: { id: number; slug: string }

const createCityIn = async (departmentCode: string, cityName: string) => {
  const academy = await createAcademy({ name: `Académie ${cityName}` })
  const department = await createDepartment({ academyId: academy.id, code: departmentCode, name: `Dép ${departmentCode}` })
  const city = await createCity({ departmentId: department.id, name: cityName, slug: cityName.toLowerCase() })
  return city.id
}

const addRequest = (
  accommodationId: number,
  values: Partial<typeof contactRequests.$inferInsert> = {},
): Promise<unknown> =>
  getTestDb()
    .insert(contactRequests)
    .values({
      accommodationId,
      firstname: 'Camille',
      lastname: 'Martin',
      email: `${crypto.randomUUID()}@test.com`,
      phone: '0601020304',
      status: EContactStatus.A_CONTACTER,
      confirmedAt: new Date(),
      ...values,
    })

const exportFor = (userId: string, filters: { region?: string; residenceSlug?: string } = {}) =>
  getBailleurContactsExport({ userId, filters })

const okRows = async (userId: string, filters: { region?: string; residenceSlug?: string } = {}) => {
  const result = await exportFor(userId, filters)
  if (result.status !== 'ok') throw new Error(`export en échec : ${result.status}`)
  return result.rows
}

const createRestrictedManager = async (scope: number[]) => {
  await createUser({ id: 'manager-id', email: 'manager@test.com', name: 'Manager', role: 'owner' })
  await getTestDb()
    .update(user)
    .set({ bailleurRole: 'gestionnaire', ownerId, applicationScopeRestricted: true, bailleurPermissions: ['manage_applications'] })
    .where(eq(user.id, 'manager-id'))
  for (const accommodationId of scope) {
    await getTestDb().insert(bailleurAccommodationScopes).values({ userId: 'manager-id', accommodationId })
  }
}

beforeEach(async () => {
  await createUser({ id: 'owner-id', name: 'Owner', email: 'owner@test.com', role: 'owner' })
  const owner = await createOwner({ name: 'Bailleur A', slug: 'bailleur-a', userId: 'owner-id', contactMode: EOwnerContactMode.CONTACTS })
  ownerId = owner.id
  await getTestDb().update(user).set({ bailleurRole: 'administrator', ownerId }).where(eq(user.id, 'owner-id'))
  resA = await createAccommodation({ slug: 'res-a', name: 'Res A', ownerId, cityId: await createCityIn('75', 'Paris') })
  resB = await createAccommodation({ slug: 'res-b', name: 'Res B', ownerId, cityId: await createCityIn('69', 'Lyon') })
})

describe('getBailleurContactsExport — mode contacts', () => {
  it('exporte les demandes visibles de toutes les résidences', async () => {
    await addRequest(resA.id, { email: 'camille@test.com' })
    await addRequest(resB.id, { firstname: 'Léa', lastname: 'Durand' })

    const rows = await okRows('owner-id')

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      residence: 'Res A',
      ville: 'Paris',
      departement: '75',
      region: 'Île-de-France',
      nom: 'Camille Martin',
      email: 'camille@test.com',
      telephone: '0601020304',
    })
    expect(rows[1]).toMatchObject({ residence: 'Res B', region: 'Auvergne-Rhône-Alpes', nom: 'Léa Durand' })
  })

  it('reprend les coordonnées du compte quand la demande ne les porte plus', async () => {
    await createUser({ id: 'student-id', email: 'compte@test.com', name: 'Étudiant Compte', role: 'user' })
    await addRequest(resA.id, { userId: 'student-id', email: null, firstname: null, lastname: null, confirmedAt: null })

    const [row] = await okRows('owner-id')

    expect(row).toMatchObject({ email: 'compte@test.com', nom: 'Étudiant Compte' })
  })

  it('exclut une demande visiteur non confirmée', async () => {
    await addRequest(resA.id, { confirmedAt: null })
    expect(await okRows('owner-id')).toEqual([])
  })

  it('exclut une demande hors durée de conservation', async () => {
    await addRequest(resA.id, { createdAt: daysAgo(CONTACT_RETENTION_DAYS + 1) })
    expect(await okRows('owner-id')).toEqual([])
  })

  it('inclut une résidence sans place libre et fermée aux demandes', async () => {
    await getTestDb()
      .update(accommodations)
      .set({ nbAvailableApartments: 0, acceptsApplications: false })
      .where(eq(accommodations.id, resA.id))
    await addRequest(resA.id)

    expect(await okRows('owner-id')).toHaveLength(1)
  })

  it('filtre par région', async () => {
    await addRequest(resA.id)
    await addRequest(resB.id)

    const rows = await okRows('owner-id', { region: 'Île-de-France' })

    expect(rows.map((r) => r.residence)).toEqual(['Res A'])
  })

  it('renvoie un export vide pour une région sans résidence', async () => {
    await addRequest(resA.id)
    expect(await okRows('owner-id', { region: 'Bretagne' })).toEqual([])
  })

  it('filtre par résidence et ignore alors la région', async () => {
    await addRequest(resA.id)
    await addRequest(resB.id)

    const rows = await okRows('owner-id', { residenceSlug: 'res-b', region: 'Île-de-France' })

    expect(rows.map((r) => r.residence)).toEqual(['Res B'])
  })

  it('refuse une résidence d’un autre bailleur', async () => {
    await createUser({ id: 'other-owner-id', email: 'other@test.com', name: 'Other', role: 'owner' })
    const other = await createOwner({ name: 'Bailleur B', slug: 'bailleur-b', userId: 'other-owner-id' })
    await createAccommodation({ slug: 'res-other', name: 'Res Other', ownerId: other.id })

    expect(await exportFor('owner-id', { residenceSlug: 'res-other' })).toEqual({ status: 'residence_not_found' })
  })

  it('n’exporte rien des autres bailleurs', async () => {
    await createUser({ id: 'other-owner-id', email: 'other@test.com', name: 'Other', role: 'owner' })
    const other = await createOwner({ name: 'Bailleur B', slug: 'bailleur-b', userId: 'other-owner-id' })
    const resOther = await createAccommodation({ slug: 'res-other', name: 'Res Other', ownerId: other.id })
    await addRequest(resOther.id)

    expect(await okRows('owner-id')).toEqual([])
  })

  it('limite un gestionnaire restreint à son périmètre', async () => {
    await createRestrictedManager([resA.id])
    await addRequest(resA.id)
    await addRequest(resB.id)

    expect((await okRows('manager-id')).map((r) => r.residence)).toEqual(['Res A'])
    expect(await exportFor('manager-id', { residenceSlug: 'res-b' })).toEqual({ status: 'residence_not_found' })
  })

  it('n’exporte rien à un gestionnaire restreint sans résidence', async () => {
    await createRestrictedManager([])
    await addRequest(resA.id)

    expect(await okRows('manager-id')).toEqual([])
  })

  it('renvoie forbidden sans bailleur', async () => {
    await createUser({ id: 'lonely-id', email: 'lonely@test.com', name: 'Lonely', role: 'owner' })
    expect(await exportFor('lonely-id')).toEqual({ status: 'forbidden' })
  })

  it('traduit statut, bourse, année d’études et dates', async () => {
    await addRequest(resA.id, {
      status: EContactStatus.CONTACTE,
      scholarshipStatus: 'unknown',
      studyYear: 'bac_5_plus',
      birthdate: '2004-03-15',
      isWorkStudy: true,
      createdAt: daysAgo(2),
    })

    const [row] = await okRows('owner-id')

    expect(row).toMatchObject({
      statut: 'Contacté',
      boursier: 'Ne sait pas',
      anneeEtudes: 'Bac+5 et +',
      dateNaissance: '2004-03-15',
      alternance: true,
    })
    expect(row.dateDemande).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('getBailleurContactsExport — mode DossierFacile', () => {
  const switchToDossierFacile = async () => {
    const { owners: ownersTable } = await import('../server/db/schema/owners')
    await getTestDb().update(ownersTable).set({ contactMode: EOwnerContactMode.DOSSIER_FACILE }).where(eq(ownersTable.id, ownerId))
  }

  const addApplication = async (accommodationSlug: string, tenantStatus = 'verified') => {
    const studentId = `student-${crypto.randomUUID().slice(0, 8)}`
    await createUser({
      id: studentId,
      email: `${studentId}@test.com`,
      name: 'Compte Étudiant',
      role: 'user',
      phone: '0700000000',
      birthdate: '2003-01-02',
      studyInstitution: 'Université de Lyon',
    })
    const tenant = await createDossierFacileTenant({ userId: studentId, name: 'Nom DossierFacile', status: tenantStatus })
    await createDossierFacileApplication({ tenantId: tenant.id, accommodationSlug, apartmentType: 'T1' })
    return studentId
  }

  it('exporte les candidatures DossierFacile validées', async () => {
    await switchToDossierFacile()
    const studentId = await addApplication('res-a')

    const [row] = await okRows('owner-id')

    expect(row).toMatchObject({
      residence: 'Res A',
      region: 'Île-de-France',
      nom: 'Nom DossierFacile',
      email: `${studentId}@test.com`,
      telephone: '0700000000',
      dateNaissance: '2003-01-02',
      etablissement: 'Université de Lyon',
      typeLogement: 'T1',
      statut: 'À modérer',
    })
  })

  it('exclut une candidature dont le dossier n’est pas validé', async () => {
    await switchToDossierFacile()
    await addApplication('res-a', 'to_process')

    expect(await okRows('owner-id')).toEqual([])
  })

  it('respecte le périmètre du gestionnaire', async () => {
    await switchToDossierFacile()
    await createRestrictedManager([resA.id])
    await addApplication('res-a')
    await addApplication('res-b')

    expect((await okRows('manager-id')).map((r) => r.residence)).toEqual(['Res A'])
  })
})
