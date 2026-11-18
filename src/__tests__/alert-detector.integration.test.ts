import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { accommodations, alertJobs, user } from '~/server/db/schema'
import { backfillAlertJobs, detectAlertJobs, enqueueJobsForNewAlert } from '~/server/services/alert-detector'
import { MAX_ATTEMPTS } from '~/server/services/alert-sender'
import {
  createAcademy,
  createAccommodation,
  createAlert,
  createCity,
  createDepartment,
  createFavoriteAccommodation,
  createOwner,
  createUser,
} from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

// Polygone simple autour de Paris + point situé à l'intérieur (intersection spatiale).
const CITY_BOUNDARY = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [2.3, 48.8],
        [2.4, 48.8],
        [2.4, 48.9],
        [2.3, 48.9],
        [2.3, 48.8],
      ],
    ],
  ],
}
const POINT_INSIDE = { type: 'Point', coordinates: [2.35, 48.85] as [number, number] }

async function setupCity() {
  const academy = await createAcademy({ name: 'Académie Test' })
  const department = await createDepartment({ academyId: academy.id, code: '75', name: 'Paris' })
  return createCity({ departmentId: department.id, name: 'Paris', slug: 'paris-test', boundary: CITY_BOUNDARY })
}

function setAvailability(accommodationId: number, nbAvailableApartments: number | null) {
  return getTestDb().update(accommodations).set({ nbAvailableApartments }).where(eq(accommodations.id, accommodationId))
}

function jobsFor(accommodationId: number) {
  return getTestDb().select().from(alertJobs).where(eq(alertJobs.accommodationId, accommodationId))
}

describe('detectAlertJobs', () => {
  it('1er run (snapshot vide) : enregistre la baseline sans créer de job', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 5,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    const result = await detectAlertJobs()

    expect(result.seeded).toBeGreaterThan(0)
    expect(result.triggered).toBe(0)
    expect(result.jobsCreated).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(0)
  })

  it('hausse 0 → x sur une résidence en zone d’une alerte active : crée un job pending', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    const alert = await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    await detectAlertJobs() // baseline (0)
    await setAvailability(accom.id, 5)
    const result = await detectAlertJobs()

    expect(result.triggered).toBe(1)
    expect(result.jobsCreated).toBe(1)

    const jobs = await jobsFor(accom.id)
    expect(jobs).toHaveLength(1)
    expect(jobs[0].status).toBe('pending')
    expect(jobs[0].studentAlertId).toBe(alert.id)
    expect(jobs[0].userId).toBe('student-1')
  })

  it('hausse non-renseigné (null) → x : déclenche aussi', async () => {
    const city = await setupCity()
    // Aucune valeur de dispo => non-renseigné (tous les nb_t*_available NULL).
    const accom = await createAccommodation({ cityId: city.id, geom: POINT_INSIDE, published: true, priceMin: 400 })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    await detectAlertJobs() // baseline (null)
    await setAvailability(accom.id, 3)
    const result = await detectAlertJobs()

    expect(result.triggered).toBe(1)
    expect(result.jobsCreated).toBe(1)
  })

  it('alerte avec notifications désactivées : la hausse est détectée mais aucun job créé', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: false })

    await detectAlertJobs()
    await setAvailability(accom.id, 5)
    const result = await detectAlertJobs()

    expect(result.triggered).toBe(1)
    expect(result.jobsCreated).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(0)
  })

  it('baisse de dispo (x → y, y < x) : aucun déclenchement', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 5,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    await detectAlertJobs() // baseline (5)
    await setAvailability(accom.id, 3)
    const result = await detectAlertJobs()

    expect(result.triggered).toBe(0)
    expect(result.jobsCreated).toBe(0)
  })

  it('re-notification : après un job sent, une nouvelle hausse x → y crée un nouveau job (index partiel)', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    await detectAlertJobs() // baseline (0)
    await setAvailability(accom.id, 2)
    await detectAlertJobs() // crée le 1er job (0 -> 2)

    // L'envoi marque le job comme envoyé.
    await getTestDb().update(alertJobs).set({ status: 'sent', sentAt: new Date() }).where(eq(alertJobs.accommodationId, accom.id))

    await setAvailability(accom.id, 5)
    const result = await detectAlertJobs() // 2 -> 5 : nouvelle hausse

    expect(result.jobsCreated).toBe(1)

    const jobs = await jobsFor(accom.id)
    expect(jobs).toHaveLength(2)
    expect(jobs.filter((j) => j.status === 'sent')).toHaveLength(1)
    expect(jobs.filter((j) => j.status === 'pending')).toHaveLength(1)
  })

  it('prix d’entrée au-dessus du plafond de l’alerte : hausse détectée mais hors matching', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 600,
      nbAvailableApartments: 0,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    await detectAlertJobs()
    await setAvailability(accom.id, 5)
    const result = await detectAlertJobs()

    expect(result.triggered).toBe(1)
    expect(result.jobsCreated).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(0)
  })

  it('échec définitif (#2) : un job failed terminal ne bloque pas une nouvelle hausse', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    await detectAlertJobs() // baseline (0)
    await setAvailability(accom.id, 2)
    await detectAlertJobs() // crée le job (0 -> 2)

    // Le job échoue définitivement (attempts = MAX_ATTEMPTS) → archivé, ne doit plus bloquer.
    await getTestDb().update(alertJobs).set({ status: 'failed', attempts: MAX_ATTEMPTS }).where(eq(alertJobs.accommodationId, accom.id))

    await setAvailability(accom.id, 5)
    const result = await detectAlertJobs() // 2 -> 5

    expect(result.jobsCreated).toBe(1)
    const jobs = await jobsFor(accom.id)
    expect(jobs).toHaveLength(2)
    expect(jobs.filter((j) => j.status === 'failed')).toHaveLength(1)
    expect(jobs.filter((j) => j.status === 'pending')).toHaveLength(1)
  })

  it('échec réessayable (#2) : une nouvelle hausse ne crée pas de doublon (coalescence)', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    await detectAlertJobs() // baseline (0)
    await setAvailability(accom.id, 2)
    await detectAlertJobs() // crée le job (0 -> 2)

    // Échec encore réessayable (attempts < MAX) → reste un job actif → pas de doublon.
    await getTestDb().update(alertJobs).set({ status: 'failed', attempts: 1 }).where(eq(alertJobs.accommodationId, accom.id))

    await setAvailability(accom.id, 5)
    const result = await detectAlertJobs() // 2 -> 5

    expect(result.jobsCreated).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(1)
  })

  it('alerte sans territoire (#3) : ignorée par le détecteur (pas de spam national)', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    // Alerte active mais SANS territoire (cityId / departmentId / academyId tous null).
    await createAlert({ userId: 'student-1', maxPrice: 500, receiveNotifications: true })

    await detectAlertJobs()
    await setAvailability(accom.id, 5)
    const result = await detectAlertJobs()

    expect(result.triggered).toBe(1)
    expect(result.jobsCreated).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(0)
  })

  it('résidence CROUS : hors périmètre, ni baseline ni job', async () => {
    const city = await setupCity()
    const crous = await createOwner({ slug: 'crous', name: 'CROUS' })
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
      ownerId: crous.id,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    await detectAlertJobs()
    await setAvailability(accom.id, 5)
    const result = await detectAlertJobs()

    expect(result.triggered).toBe(0)
    expect(result.jobsCreated).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(0)
  })

  it('scopé (mode événementiel) : ne traite que les accommodationIds passés', async () => {
    const city = await setupCity()
    const accomA = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    const accomB = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    await detectAlertJobs() // baseline (A et B à 0)
    await setAvailability(accomA.id, 5)
    await setAvailability(accomB.id, 5)

    // Seule A est passée dans le scope : B est ignorée même si sa dispo a augmenté.
    const result = await detectAlertJobs({ accommodationIds: [accomA.id] })

    expect(result.triggered).toBe(1)
    expect(result.jobsCreated).toBe(1)
    expect(await jobsFor(accomA.id)).toHaveLength(1)
    expect(await jobsFor(accomB.id)).toHaveLength(0)
  })

  it('scopé avec liste vide : aucun traitement', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    await detectAlertJobs()
    await setAvailability(accom.id, 5)
    const result = await detectAlertJobs({ accommodationIds: [] })

    expect(result.triggered).toBe(0)
    expect(result.jobsCreated).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(0)
  })
})

describe('enqueueJobsForNewAlert (flux pull à la création d’alerte)', () => {
  it('stock déjà disponible qui matche : enfile un job pending', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 5,
    })
    const alert = await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    const created = await enqueueJobsForNewAlert(alert.id)

    expect(created).toBe(1)
    const jobs = await jobsFor(accom.id)
    expect(jobs).toHaveLength(1)
    expect(jobs[0].status).toBe('pending')
    expect(jobs[0].studentAlertId).toBe(alert.id)
    expect(jobs[0].userId).toBe('student-1')
  })

  it('résidence sans dispo (non-renseigné) : aucun job', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({ cityId: city.id, geom: POINT_INSIDE, published: true, priceMin: 400 })
    const alert = await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    const created = await enqueueJobsForNewAlert(alert.id)

    expect(created).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(0)
  })

  it('alerte sans territoire : aucun job (pas de spam national)', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 5,
    })
    const alert = await createAlert({ userId: 'student-1', maxPrice: 500, receiveNotifications: true })

    const created = await enqueueJobsForNewAlert(alert.id)

    expect(created).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(0)
  })

  it('alerte en opt-out (receiveNotifications=false) : aucun job', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 5,
    })
    const alert = await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: false })

    const created = await enqueueJobsForNewAlert(alert.id)

    expect(created).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(0)
  })

  it('prix d’entrée au-dessus du plafond : aucun job', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 600,
      nbAvailableApartments: 5,
    })
    const alert = await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    const created = await enqueueJobsForNewAlert(alert.id)

    expect(created).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(0)
  })

  it('idempotence : un second appel ne crée pas de doublon (index unique partiel)', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 5,
    })
    const alert = await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    expect(await enqueueJobsForNewAlert(alert.id)).toBe(1)
    expect(await enqueueJobsForNewAlert(alert.id)).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(1)
  })
})

describe('backfillAlertJobs (vague initiale pour les alertes existantes)', () => {
  it('enfile un job par couple alerte active × stock dispo qui matche', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 5,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })
    await createAlert({ userId: 'student-2', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    const { alertsProcessed, jobsCreated } = await backfillAlertJobs()

    expect(alertsProcessed).toBe(2)
    expect(jobsCreated).toBe(2)
    expect(await jobsFor(accom.id)).toHaveLength(2)
  })

  it('dry-run : compte les jobs candidats sans rien écrire', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 5,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    const { jobsCreated } = await backfillAlertJobs({ dryRun: true })

    expect(jobsCreated).toBe(1)
    expect(await jobsFor(accom.id)).toHaveLength(0)
  })

  it('ne touche pas le snapshot (le détecteur reste muet juste après)', async () => {
    const city = await setupCity()
    await createAccommodation({ cityId: city.id, geom: POINT_INSIDE, published: true, priceMin: 400, nbAvailableApartments: 5 })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    await backfillAlertJobs()
    // Snapshot non amorcé par le backfill : le 1er run du détecteur ne fait que poser la baseline.
    const result = await detectAlertJobs()

    expect(result.jobsCreated).toBe(0)
  })

  it('exclut les alertes opt-out et sans territoire', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 5,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: false }) // opt-out
    await createAlert({ userId: 'student-2', maxPrice: 500, receiveNotifications: true }) // sans territoire
    await createAlert({ userId: 'student-3', cityId: city.id, maxPrice: 500, receiveNotifications: true }) // éligible

    const { alertsProcessed, jobsCreated } = await backfillAlertJobs()

    expect(alertsProcessed).toBe(1)
    expect(jobsCreated).toBe(1)
    expect(await jobsFor(accom.id)).toHaveLength(1)
  })

  it('idempotent : un second run ne crée pas de doublon', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 5,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    expect((await backfillAlertJobs()).jobsCreated).toBe(1)
    expect((await backfillAlertJobs()).jobsCreated).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(1)
  })

  it('inclut les favoris avec dispo > 0', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 5,
    })
    await createUser({ id: 'student-fav' })
    await createFavoriteAccommodation({ userId: 'student-fav', accommodationId: accom.id })

    const { jobsCreated } = await backfillAlertJobs()

    expect(jobsCreated).toBe(1)
    const jobs = await jobsFor(accom.id)
    expect(jobs).toHaveLength(1)
    expect(jobs[0].source).toBe('favorite')
    expect(jobs[0].studentAlertId).toBeNull()
    expect(jobs[0].userId).toBe('student-fav')
  })

  it('ne crée pas de job favori pour une résidence sans dispo', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    await createUser({ id: 'student-fav' })
    await createFavoriteAccommodation({ userId: 'student-fav', accommodationId: accom.id })

    const { jobsCreated } = await backfillAlertJobs()

    expect(jobsCreated).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(0)
  })
})

describe('detectAlertJobs — favoris', () => {
  it("hausse de dispo d'une résidence favorite : crée un job source=favorite", async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    await createUser({ id: 'student-fav' })
    await createFavoriteAccommodation({ userId: 'student-fav', accommodationId: accom.id })

    await detectAlertJobs() // baseline (0)
    await setAvailability(accom.id, 5)
    const result = await detectAlertJobs()

    expect(result.triggered).toBe(1)
    expect(result.jobsCreated).toBe(1)

    const jobs = await jobsFor(accom.id)
    expect(jobs).toHaveLength(1)
    expect(jobs[0].source).toBe('favorite')
    expect(jobs[0].studentAlertId).toBeNull()
    expect(jobs[0].userId).toBe('student-fav')
    expect(jobs[0].status).toBe('pending')
  })

  it('hausse détectée : crée à la fois un job alerte et un job favori', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    await createAlert({ userId: 'student-alert', cityId: city.id, maxPrice: 500, receiveNotifications: true })
    await createUser({ id: 'student-fav' })
    await createFavoriteAccommodation({ userId: 'student-fav', accommodationId: accom.id })

    await detectAlertJobs() // baseline
    await setAvailability(accom.id, 3)
    const result = await detectAlertJobs()

    expect(result.jobsCreated).toBe(2)
    const jobs = await jobsFor(accom.id)
    expect(jobs.find((j) => j.source === 'alert')).toBeDefined()
    expect(jobs.find((j) => j.source === 'favorite')).toBeDefined()
  })

  it("job favori : idempotent (onConflictDoNothing sur l'index partiel)", async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    await createUser({ id: 'student-fav' })
    await createFavoriteAccommodation({ userId: 'student-fav', accommodationId: accom.id })

    await detectAlertJobs() // baseline
    await setAvailability(accom.id, 3)
    await detectAlertJobs() // crée le job

    await setAvailability(accom.id, 5)
    // Le job précédent est encore pending → pas de doublon
    const result = await detectAlertJobs()
    expect(result.jobsCreated).toBe(0)
    expect(await jobsFor(accom.id)).toHaveLength(1)
  })

  it("suppression d'un favori annule les jobs pending correspondants", async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    await createUser({ id: 'student-fav' })
    await createFavoriteAccommodation({ userId: 'student-fav', accommodationId: accom.id })

    // Créer un job pending via une hausse de dispo
    await detectAlertJobs() // baseline
    await setAvailability(accom.id, 5)
    await detectAlertJobs()
    expect(await jobsFor(accom.id)).toHaveLength(1)

    // Simule la suppression du favori (annulation des pending comme le fait favorites.remove)
    await getTestDb()
      .delete(alertJobs)
      .where(
        and(
          eq(alertJobs.userId, 'student-fav'),
          eq(alertJobs.accommodationId, accom.id),
          eq(alertJobs.source, 'favorite'),
          eq(alertJobs.status, 'pending'),
        ),
      )

    expect(await jobsFor(accom.id)).toHaveLength(0)
  })
})

// ~1,5 km à l'est de la frontière de la ville (dans la zone élargie de 10 km) / ~15 km (hors zone).
const POINT_NEARBY = { type: 'Point', coordinates: [2.42, 48.85] as [number, number] }
const POINT_FAR = { type: 'Point', coordinates: [2.6, 48.85] as [number, number] }

describe('suggestions similaires (zone élargie +10 km / +25 % budget)', () => {
  it('crée un job « similar » pour une résidence proche hors ville dans le budget élargi', async () => {
    const city = await setupCity()
    // priceMin 600 : au-dessus du budget de l'alerte (500) mais sous le budget élargi (625).
    const nearby = await createAccommodation({
      cityId: city.id,
      geom: POINT_NEARBY,
      published: true,
      priceMin: 600,
      nbAvailableApartments: 0,
    })
    const alert = await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    await detectAlertJobs() // baseline
    await setAvailability(nearby.id, 3)
    const result = await detectAlertJobs()

    expect(result.jobsCreated).toBe(1)
    const jobs = await jobsFor(nearby.id)
    expect(jobs).toHaveLength(1)
    expect(jobs[0].source).toBe('similar')
    expect(jobs[0].studentAlertId).toBe(alert.id)
    expect(jobs[0].status).toBe('pending')
  })

  it('ignore les résidences trop loin ou trop chères, et les alertes non-ville', async () => {
    const city = await setupCity()
    const far = await createAccommodation({ cityId: city.id, geom: POINT_FAR, published: true, priceMin: 450, nbAvailableApartments: 0 })
    const tooExpensive = await createAccommodation({
      cityId: city.id,
      geom: POINT_NEARBY,
      published: true,
      priceMin: 700,
      nbAvailableApartments: 0,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })
    await createAlert({ userId: 'student-2', departmentId: city.departmentId, maxPrice: 900, receiveNotifications: true })

    await detectAlertJobs() // baseline
    await setAvailability(far.id, 2)
    await setAvailability(tooExpensive.id, 2)
    await detectAlertJobs()

    const similarJobs = (await getTestDb().select().from(alertJobs)).filter((j) => j.source === 'similar')
    expect(similarJobs).toHaveLength(0)
  })

  it('ne crée aucun job « similar » quand la préférence « logements similaires » est désactivée', async () => {
    const city = await setupCity()
    const nearby = await createAccommodation({
      cityId: city.id,
      geom: POINT_NEARBY,
      published: true,
      priceMin: 450,
      nbAvailableApartments: 0,
    })
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })
    await getTestDb().update(user).set({ similarAccommodationAlertsEnabled: false }).where(eq(user.id, 'student-1'))

    await detectAlertJobs() // baseline
    await setAvailability(nearby.id, 3)
    const result = await detectAlertJobs()

    expect(result.jobsCreated).toBe(0)
    expect(await jobsFor(nearby.id)).toHaveLength(0)
  })

  it('plafonne les suggestions à 6 par alerte et par run', async () => {
    const city = await setupCity()
    const nearbyIds: number[] = []
    for (let i = 0; i < 8; i++) {
      const accom = await createAccommodation({
        cityId: city.id,
        geom: { type: 'Point', coordinates: [2.41 + i * 0.001, 48.85] },
        published: true,
        priceMin: 450,
        nbAvailableApartments: 0,
      })
      nearbyIds.push(accom.id)
    }
    await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    await detectAlertJobs() // baseline
    for (const id of nearbyIds) await setAvailability(id, 2)
    const result = await detectAlertJobs()

    expect(result.jobsCreated).toBe(6)
  })

  it('enqueueJobsForNewAlert enfile aussi les suggestions du stock déjà disponible', async () => {
    const city = await setupCity()
    const inside = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 4,
    })
    const nearby = await createAccommodation({
      cityId: city.id,
      geom: POINT_NEARBY,
      published: true,
      priceMin: 600,
      nbAvailableApartments: 2,
    })
    const alert = await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    const created = await enqueueJobsForNewAlert(alert.id)

    expect(created).toBe(2)
    expect((await jobsFor(inside.id))[0]?.source).toBe('alert')
    expect((await jobsFor(nearby.id))[0]?.source).toBe('similar')
  })
})
