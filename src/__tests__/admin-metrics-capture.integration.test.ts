import { and, eq, inArray } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { EContactStatus } from '~/enums/contact-status'
import { EMonthlyMetric } from '~/enums/monthly-metric'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { captureMonthlyMetrics, syncApplicationFacts } from '~/server/admin-metrics/capture'
import { activityLog, applicationFacts, contactRequests, dossierFacileTenants, monthlyMetrics, trackingEvents } from '~/server/db/schema'
import {
  createAcademy,
  createAccommodation,
  createCity,
  createDepartment,
  createDossierFacileApplication,
  createDossierFacileTenant,
  createExternalSource,
  createOwner,
  createTrackingEvent,
  createUser,
} from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const NOW = new Date('2026-11-15T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

async function createTestCity() {
  const academy = await createAcademy({ name: 'Académie Relevé' })
  const department = await createDepartment({ academyId: academy.id, name: 'Département Relevé', code: '42' })
  return createCity({ departmentId: department.id, name: 'Ville Relevé', slug: 'ville-releve' })
}

async function readMetrics(month: string, metrics: EMonthlyMetric[]) {
  return getTestDb()
    .select({
      metric: monthlyMetrics.metric,
      scope: monthlyMetrics.scope,
      scopeId: monthlyMetrics.scopeId,
      value: monthlyMetrics.value,
      boursiers: monthlyMetrics.boursiers,
    })
    .from(monthlyMetrics)
    .where(and(eq(monthlyMetrics.month, month), inArray(monthlyMetrics.metric, metrics)))
}

async function readMetric(month: string, metric: EMonthlyMetric, scopeId = 0) {
  const rows = await readMetrics(month, [metric])
  return rows.find((row) => row.scopeId === scopeId) ?? null
}

describe('syncApplicationFacts', () => {
  it('garde une candidature DossierFacile après suppression de la source', async () => {
    const db = getTestDb()
    const city = await createTestCity()
    const owner = await createOwner({ slug: 'bailleur-df' })
    const residence = await createAccommodation({ slug: 'residence-df', ownerId: owner.id, cityId: city.id })
    await createUser({ id: 'student-df', scholarshipStatus: 'yes' })
    const tenant = await createDossierFacileTenant({ userId: 'student-df' })
    const application = await createDossierFacileApplication({
      tenantId: tenant.id,
      accommodationSlug: residence.slug,
      apartmentType: 't1',
    })

    expect(await syncApplicationFacts()).toBe(1)

    await db.delete(dossierFacileTenants).where(eq(dossierFacileTenants.id, tenant.id))
    await syncApplicationFacts()

    const [fact] = await db
      .select()
      .from(applicationFacts)
      .where(eq(applicationFacts.id, `df:${application.id}`))
    expect(fact).toMatchObject({
      channel: 'dossier_facile',
      ownerId: owner.id,
      accommodationId: residence.id,
      cityId: city.id,
      scholarshipStatus: 'yes',
      status: EContactStatus.A_MODERER,
    })
  })

  it('prend la première modération du journal comme firstTreatedAt', async () => {
    const db = getTestDb()
    const residence = await createAccommodation({ slug: 'residence-contact' })
    const createdAt = new Date('2026-10-01T10:00:00Z')
    const [contact] = await db
      .insert(contactRequests)
      .values({
        accommodationId: residence.id,
        email: 'visiteur@test.fr',
        confirmedAt: createdAt,
        scholarshipStatus: 'no',
        status: EContactStatus.LOGEMENT_ATTRIBUE,
        reviewedAt: new Date(createdAt.getTime() + 9 * DAY_MS),
        createdAt,
      })
      .returning()
    await db.insert(activityLog).values([
      {
        action: 'contact.status_updated',
        entityType: 'contact_request',
        entityId: contact.id,
        createdAt: new Date(createdAt.getTime() + 5 * DAY_MS),
        metadata: { diff: { contactStatus: { old: EContactStatus.CONTACTE, new: EContactStatus.LOGEMENT_ATTRIBUE } } },
      },
      {
        action: 'contact.status_updated',
        entityType: 'contact_request',
        entityId: contact.id,
        createdAt: new Date(createdAt.getTime() + 2 * DAY_MS),
        metadata: { diff: { contactStatus: { old: EContactStatus.A_CONTACTER, new: EContactStatus.CONTACTE } } },
      },
    ])

    await syncApplicationFacts()

    const [fact] = await db
      .select()
      .from(applicationFacts)
      .where(eq(applicationFacts.id, `contact:${contact.id}`))
    expect(fact.firstTreatedAt).toEqual(new Date(createdAt.getTime() + 2 * DAY_MS))
    expect(fact.attributedAt).toEqual(new Date(createdAt.getTime() + 5 * DAY_MS))
    expect(fact.status).toBe(EContactStatus.LOGEMENT_ATTRIBUE)
  })

  it('ignore les demandes visiteur non confirmées et les dossiers non vérifiés', async () => {
    const db = getTestDb()
    const residence = await createAccommodation({ slug: 'residence-filtres' })
    await db.insert(contactRequests).values({ accommodationId: residence.id, email: 'nonconfirme@test.fr' })
    await createUser({ id: 'student-pending' })
    const tenant = await createDossierFacileTenant({ userId: 'student-pending', status: 'to_process' })
    await createDossierFacileApplication({ tenantId: tenant.id, accommodationSlug: residence.slug, apartmentType: 't1' })

    expect(await syncApplicationFacts()).toBe(0)
    expect(await db.select().from(applicationFacts)).toHaveLength(0)
  })

  it('garde le statut boursier connu après anonymisation de la demande', async () => {
    const db = getTestDb()
    const residence = await createAccommodation({ slug: 'residence-anonymisee' })
    const [contact] = await db
      .insert(contactRequests)
      .values({ accommodationId: residence.id, email: 'boursier@test.fr', confirmedAt: new Date(), scholarshipStatus: 'yes' })
      .returning()
    await syncApplicationFacts()

    await db
      .update(contactRequests)
      .set({ email: null, scholarshipStatus: null, anonymizedAt: new Date() })
      .where(eq(contactRequests.id, contact.id))
    await syncApplicationFacts()

    const [fact] = await db
      .select()
      .from(applicationFacts)
      .where(eq(applicationFacts.id, `contact:${contact.id}`))
    expect(fact.scholarshipStatus).toBe('yes')
  })
})

describe('captureMonthlyMetrics', () => {
  it('ne fait jamais baisser un compteur de mois clos', async () => {
    const db = getTestDb()
    const residence = await createAccommodation({ slug: 'residence-clics' })
    await createUser({ id: 'student-scholar', scholarshipStatus: 'yes' })
    const clickedAt = new Date('2026-10-10T10:00:00Z')
    const first = await createTrackingEvent({
      type: 'accommodation.consult_offer',
      accommodationId: residence.id,
      userId: 'student-scholar',
      createdAt: clickedAt,
    })
    const second = await createTrackingEvent({ type: 'accommodation.consult_offer', accommodationId: residence.id, createdAt: clickedAt })
    await createTrackingEvent({ type: 'accommodation.consult_offer', accommodationId: residence.id, createdAt: clickedAt })

    await captureMonthlyMetrics({ backfillMonths: 1, now: NOW })
    expect(await readMetric('2026-10', EMonthlyMetric.CONSULT_OFFER)).toMatchObject({ scope: 'global', value: 3, boursiers: 1 })

    await db.delete(trackingEvents).where(inArray(trackingEvents.id, [first.id, second.id]))
    await captureMonthlyMetrics({ backfillMonths: 1, now: NOW })
    expect(await readMetric('2026-10', EMonthlyMetric.CONSULT_OFFER)).toMatchObject({ value: 3, boursiers: 1 })
  })

  it('compte les recherches par ville au mois de Paris', async () => {
    const city = await createTestCity()
    await createTrackingEvent({ type: 'search.city', cityId: city.id, createdAt: new Date('2026-10-31T23:30:00Z') })
    await createTrackingEvent({ type: 'search.city', cityId: city.id, createdAt: new Date('2026-11-02T10:00:00Z') })

    await captureMonthlyMetrics({ backfillMonths: 1, now: NOW })

    expect(await readMetric('2026-11', EMonthlyMetric.SEARCH_CITY, city.id)).toMatchObject({ scope: 'city', value: 2 })
    expect(await readMetric('2026-10', EMonthlyMetric.SEARCH_CITY, city.id)).toBeNull()
  })

  it('est idempotent', async () => {
    const db = getTestDb()
    const city = await createTestCity()
    await createAccommodation({ slug: 'residence-idem', cityId: city.id, nbTotalApartments: 10, nbAvailableApartments: 2 })
    await createTrackingEvent({ type: 'search.city', cityId: city.id, createdAt: new Date('2026-11-02T10:00:00Z') })
    await createUser({ id: 'student-idem' })

    await captureMonthlyMetrics({ now: NOW })
    const select = () =>
      db
        .select({
          month: monthlyMetrics.month,
          metric: monthlyMetrics.metric,
          scope: monthlyMetrics.scope,
          scopeId: monthlyMetrics.scopeId,
          value: monthlyMetrics.value,
          boursiers: monthlyMetrics.boursiers,
        })
        .from(monthlyMetrics)
        .orderBy(monthlyMetrics.metric, monthlyMetrics.scopeId)
    const firstRun = await select()
    await captureMonthlyMetrics({ now: NOW })

    expect(firstRun.length).toBeGreaterThan(0)
    expect(await select()).toEqual(firstRun)
  })

  it('ne réécrit pas les états d’un mois clos', async () => {
    const city = await createTestCity()
    await createAccommodation({ slug: 'residence-close', cityId: city.id, nbTotalApartments: 10, nbAvailableApartments: 2 })

    await captureMonthlyMetrics({ backfillMonths: 1, now: NOW })

    expect(await readMetrics('2026-10', [EMonthlyMetric.CITY_AVAILABLE, EMonthlyMetric.STUDENTS_TOTAL])).toHaveLength(0)
    expect(await readMetric('2026-11', EMonthlyMetric.CITY_AVAILABLE, city.id)).toMatchObject({ value: 2 })
  })

  it('compte la tension sur les résidences renseignées', async () => {
    const city = await createTestCity()
    await createAccommodation({ slug: 'residence-a', cityId: city.id, nbTotalApartments: 10, nbAvailableApartments: 2 })
    await createAccommodation({ slug: 'residence-b', cityId: city.id, nbTotalApartments: 30, nbAvailableApartments: null })
    await createAccommodation({
      slug: 'residence-c',
      cityId: city.id,
      published: false,
      nbTotalApartments: 50,
      nbAvailableApartments: 5,
    })

    await captureMonthlyMetrics({ now: NOW })

    expect(await readMetric('2026-11', EMonthlyMetric.CITY_AVAILABLE, city.id)).toMatchObject({ scope: 'city', value: 2 })
    expect(await readMetric('2026-11', EMonthlyMetric.CITY_KNOWN_TOTAL, city.id)).toMatchObject({ value: 10 })
    expect(await readMetric('2026-11', EMonthlyMetric.CITY_PUBLISHED_TOTAL, city.id)).toMatchObject({ value: 40 })
  })

  it('compte les résidences ouvertes sans contact dans le mois', async () => {
    const db = getTestDb()
    const city = await createTestCity()
    const open = await createOwner({ slug: 'bailleur-ouvert', contactMode: EOwnerContactMode.CONTACTS })
    const closed = await createOwner({ slug: 'bailleur-ferme', contactMode: EOwnerContactMode.NONE })
    const contacted = await createAccommodation({ slug: 'residence-contactee', cityId: city.id, ownerId: open.id })
    await createAccommodation({ slug: 'residence-sans-contact', cityId: city.id, ownerId: open.id })
    await createAccommodation({ slug: 'residence-suspendue', cityId: city.id, ownerId: open.id, applicationsSuspendedAt: NOW })
    await createAccommodation({ slug: 'residence-fermee', cityId: city.id, ownerId: closed.id })
    await db.insert(contactRequests).values({
      accommodationId: contacted.id,
      email: 'contact@test.fr',
      confirmedAt: new Date('2026-11-03T10:00:00Z'),
      createdAt: new Date('2026-11-03T10:00:00Z'),
    })

    await captureMonthlyMetrics({ now: NOW })

    expect(await readMetric('2026-11', EMonthlyMetric.CITY_OPEN_RESIDENCES, city.id)).toMatchObject({ value: 2 })
    expect(await readMetric('2026-11', EMonthlyMetric.CITY_OPEN_RESIDENCES_WITHOUT_CONTACT, city.id)).toMatchObject({ value: 1 })
  })

  it('relève le parcours contact hors CROUS, les gestionnaires et les étudiants', async () => {
    const activated = await createOwner({ slug: 'bailleur-active', contactMode: EOwnerContactMode.DOSSIER_FACILE })
    const inactive = await createOwner({ slug: 'bailleur-inactif' })
    const crous = await createOwner({ slug: 'crous' })
    await createAccommodation({ slug: 'residence-activee', ownerId: activated.id, nbTotalApartments: 20, nbAvailableApartments: 3 })
    await createAccommodation({ slug: 'residence-inactive', ownerId: inactive.id, nbTotalApartments: 60, nbAvailableApartments: 0 })
    await createAccommodation({ slug: 'residence-sans-total', ownerId: inactive.id, nbTotalApartments: null })
    const crousResidence = await createAccommodation({
      slug: 'residence-crous',
      ownerId: crous.id,
      nbTotalApartments: 100,
      nbAvailableApartments: 4,
    })
    await createExternalSource({ accommodationId: crousResidence.id, source: 'crous' })
    await createUser({ id: 'student-yes', scholarshipStatus: 'yes' })
    await createUser({ id: 'student-no', scholarshipStatus: 'no' })
    await createUser({ id: 'owner-user', role: 'owner' })

    await captureMonthlyMetrics({ now: NOW })

    expect(await readMetric('2026-11', EMonthlyMetric.APARTMENTS_PUBLISHED_HORS_CROUS)).toMatchObject({ scope: 'global', value: 80 })
    expect(await readMetric('2026-11', EMonthlyMetric.APARTMENTS_CONTACT_ACTIVATED_HORS_CROUS)).toMatchObject({ value: 20 })
    expect(await readMetric('2026-11', EMonthlyMetric.RESIDENCES_NULL_TOTAL_HORS_CROUS)).toMatchObject({ value: 1 })
    expect(await readMetric('2026-11', EMonthlyMetric.OWNERS_CONTACT_ACTIVATED)).toMatchObject({ value: 1 })
    expect(await readMetric('2026-11', EMonthlyMetric.OWNERS_WITH_AVAILABILITY)).toMatchObject({ value: 2 })
    expect(await readMetric('2026-11', EMonthlyMetric.STUDENTS_TOTAL)).toMatchObject({ value: 2, boursiers: 1 })
  })
})
