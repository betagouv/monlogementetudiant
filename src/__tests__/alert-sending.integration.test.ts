import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { accommodations, alertJobs, jobRuns } from '~/server/db/schema'
import { reportAlertFailures } from '~/server/jobs/tasks/report-alert-failures'
import { requeuePendingAlerts } from '~/server/jobs/tasks/requeue-pending-alerts'
import { sendAlertBatchTask } from '~/server/jobs/tasks/send-alert-batch'
import { backfillAlertJobs, detectAlertJobs, enqueueJobsForNewAlert } from '~/server/services/alert-detector'
import { sendAlertBatch } from '~/server/services/alert-sender'
import {
  createAcademy,
  createAccommodation,
  createAlert,
  createCity,
  createDepartment,
  createFavoriteAccommodation,
} from './fixtures/factories'
import './helpers/setup-integration'
import { getTestDb } from './helpers/test-db'

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  sendStudentAlertEmail: vi.fn(),
  notifyCronFailure: vi.fn(),
}))

vi.mock('~/server/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/server/env')>()
  Object.assign(mocks.env, actual.env, { NEXT_PUBLIC_APP_ENV: 'production' })
  return { env: mocks.env }
})

vi.mock('~/server/services/brevo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/server/services/brevo')>()),
  sendStudentAlertEmail: mocks.sendStudentAlertEmail,
}))

vi.mock('../../cli/cron-failure', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../cli/cron-failure')>()),
  notifyCronFailure: mocks.notifyCronFailure,
}))

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

type TGraphileJob = {
  task_identifier: string
  key: string
  run_at: Date | string
  payload: unknown
  queue_name: string | null
  max_attempts: number
}

async function listGraphileJobs() {
  const rows = await getTestDb().execute<TGraphileJob>(
    sql`
      select t.identifier as task_identifier, j.key, j.run_at, j.payload, q.queue_name, j.max_attempts
      from graphile_worker._private_jobs j
      join graphile_worker._private_tasks t on t.id = j.task_id
      left join graphile_worker._private_job_queues q on q.id = j.job_queue_id
      order by j.id
    `,
  )
  return [...rows]
}

async function clearGraphileJobs() {
  await getTestDb().execute(sql`delete from graphile_worker._private_jobs`)
}

async function setupCity() {
  const academy = await createAcademy({ name: 'Académie Test' })
  const department = await createDepartment({ academyId: academy.id, code: '75', name: 'Paris' })
  return createCity({ departmentId: department.id, name: 'Paris', slug: 'paris-test', boundary: CITY_BOUNDARY })
}

async function createAlertWithJobs(sources: ('alert' | 'similar')[]) {
  const city = await setupCity()
  const alert = await createAlert({
    userId: 'student-1',
    name: 'Paris pas cher',
    cityId: city.id,
    maxPrice: 500,
    receiveNotifications: true,
  })
  const rows = []
  for (const [index, source] of sources.entries()) {
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      name: `Résidence ${index}`,
    })
    const [row] = await getTestDb()
      .insert(alertJobs)
      .values({ userId: 'student-1', studentAlertId: alert.id, accommodationId: accom.id, source })
      .returning()
    rows.push(row)
  }
  return { city, alert, rows }
}

function setAvailability(accommodationId: number, nbAvailableApartments: number) {
  return getTestDb().update(accommodations).set({ nbAvailableApartments }).where(eq(accommodations.id, accommodationId))
}

function jobsOf(studentAlertId: number) {
  return getTestDb().select().from(alertJobs).where(eq(alertJobs.studentAlertId, studentAlertId)).orderBy(alertJobs.id)
}

beforeEach(() => {
  mocks.env.NEXT_PUBLIC_APP_ENV = 'production'
  mocks.sendStudentAlertEmail.mockReset()
  mocks.sendStudentAlertEmail.mockResolvedValue(undefined)
  mocks.notifyCronFailure.mockReset()
  mocks.notifyCronFailure.mockResolvedValue(true)
})

describe('détection → tâche send-alert-batch', () => {
  it('crée les alert_job et une tâche par lot, sans doublon ni report de run_at', async () => {
    const city = await setupCity()
    const first = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    const second = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 0,
    })
    const alert = await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })
    await createFavoriteAccommodation({ userId: 'student-2', accommodationId: first.id })

    await detectAlertJobs()
    await setAvailability(first.id, 5)
    await detectAlertJobs()

    expect(await jobsOf(alert.id)).toHaveLength(1)
    const queued = await listGraphileJobs()
    expect(queued.map((j) => j.key).sort()).toEqual([`alert:${alert.id}`, 'favorite:student-2'])
    for (const job of queued) {
      expect(job.task_identifier).toBe('send-alert-batch')
      expect(job.queue_name).toBe('alert-send')
      expect(job.max_attempts).toBe(3)
    }
    const alertTask = queued.find((j) => j.key === `alert:${alert.id}`)!
    expect(alertTask.payload).toEqual({ kind: 'alert', studentAlertId: alert.id })
    expect(queued.find((j) => j.key === 'favorite:student-2')!.payload).toEqual({ kind: 'favorite', userId: 'student-2' })
    const runAt = new Date(alertTask.run_at).getTime()
    expect(runAt).toBeGreaterThan(Date.now() + 30_000)

    await setAvailability(second.id, 2)
    await detectAlertJobs()

    expect(await jobsOf(alert.id)).toHaveLength(2)
    const requeued = await listGraphileJobs()
    expect(requeued).toHaveLength(2)
    expect(new Date(requeued.find((j) => j.key === `alert:${alert.id}`)!.run_at).getTime()).toBe(runAt)
  })

  it("ne met rien en file quand aucune ligne n'est créée", async () => {
    const { alert, rows } = await createAlertWithJobs(['alert'])
    await detectAlertJobs()
    await setAvailability(rows[0].accommodationId, 3)
    expect(await detectAlertJobs()).toMatchObject({ triggered: 1, jobsCreated: 0 })

    expect(await jobsOf(alert.id)).toHaveLength(1)
    expect(await listGraphileJobs()).toHaveLength(0)
  })
})

describe('sendAlertBatch', () => {
  it('envoie un seul mail regroupant alert + similar, lignes sent avec le même sendId', async () => {
    const { alert } = await createAlertWithJobs(['alert', 'alert', 'similar'])

    const result = await sendAlertBatch({ kind: 'alert', studentAlertId: alert.id }, { number: 1, max: 3 })

    expect(result).toEqual({ sent: true, housings: 3, failed: false })
    expect(mocks.sendStudentAlertEmail).toHaveBeenCalledTimes(1)
    const [email, params] = mocks.sendStudentAlertEmail.mock.calls[0]
    expect(email).toBe('student-1@test.com')
    expect(params.alertName).toBe('Paris pas cher')
    expect(params.accommodations.map((a: { nom: string }) => a.nom)).toEqual(['Résidence 0', 'Résidence 1'])
    expect(params.suggestions.map((a: { nom: string }) => a.nom)).toEqual(['Résidence 2'])
    expect(params.accommodations[0].url).toMatch(new RegExp(`^${mocks.env.BASE_URL}/trouver-un-logement-etudiant/ville/Paris/[a-z0-9-]+$`))

    const jobs = await jobsOf(alert.id)
    expect(jobs.every((j) => j.status === 'sent' && j.attempts === 1 && j.sentAt !== null)).toBe(true)
    expect(new Set(jobs.map((j) => j.sendId)).size).toBe(1)
    expect(jobs[0].sendId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('plafonne les suggestions et solde quand même toutes les lignes du lot', async () => {
    const { alert } = await createAlertWithJobs(['alert', ...Array.from({ length: 8 }, () => 'similar' as const)])

    await sendAlertBatch({ kind: 'alert', studentAlertId: alert.id }, { number: 1, max: 3 })

    expect(mocks.sendStudentAlertEmail.mock.calls[0][1].suggestions).toHaveLength(6)
    expect((await jobsOf(alert.id)).every((j) => j.status === 'sent')).toBe(true)
  })

  it('regroupe les favoris par étudiant', async () => {
    const a = await createAccommodation({ published: true, name: 'Fav A' })
    const b = await createAccommodation({ published: true, name: 'Fav B' })
    await createFavoriteAccommodation({ userId: 'student-3', accommodationId: a.id })
    await getTestDb()
      .insert(alertJobs)
      .values([
        { userId: 'student-3', accommodationId: a.id, source: 'favorite' },
        { userId: 'student-3', accommodationId: b.id, source: 'favorite' },
      ])

    const result = await sendAlertBatch({ kind: 'favorite', userId: 'student-3' }, { number: 1, max: 3 })

    expect(result).toEqual({ sent: true, housings: 2, failed: false })
    const [, params] = mocks.sendStudentAlertEmail.mock.calls[0]
    expect(params.alertName).toBe('Mes favoris')
    expect(params.accommodations).toHaveLength(2)
  })

  it('deux envois successifs : un seul mail, puis seulement la ligne ajoutée entre-temps', async () => {
    const { alert, city } = await createAlertWithJobs(['alert'])
    const key = { kind: 'alert', studentAlertId: alert.id } as const

    await sendAlertBatch(key, { number: 1, max: 3 })
    const again = await sendAlertBatch(key, { number: 1, max: 3 })
    expect(again).toEqual({ sent: false, housings: 0, failed: false })
    expect(mocks.sendStudentAlertEmail).toHaveBeenCalledTimes(1)

    const added = await createAccommodation({ cityId: city.id, geom: POINT_INSIDE, published: true, name: 'Nouvelle' })
    await getTestDb()
      .insert(alertJobs)
      .values({ userId: 'student-1', studentAlertId: alert.id, accommodationId: added.id, source: 'alert' })
    await sendAlertBatch(key, { number: 1, max: 3 })

    expect(mocks.sendStudentAlertEmail).toHaveBeenCalledTimes(2)
    expect(mocks.sendStudentAlertEmail.mock.calls[1][1].accommodations.map((a: { nom: string }) => a.nom)).toEqual(['Nouvelle'])
  })

  it('lot vide : rien envoyé', async () => {
    expect(await sendAlertBatch({ kind: 'favorite', userId: 'nobody' }, { number: 1, max: 3 })).toEqual({
      sent: false,
      housings: 0,
      failed: false,
    })
    expect(mocks.sendStudentAlertEmail).not.toHaveBeenCalled()
  })

  it('échec Brevo : pending et relance dans 30 min tant que des tentatives restent, failed à la dernière', async () => {
    const { alert } = await createAlertWithJobs(['alert', 'similar'])
    const key = { kind: 'alert', studentAlertId: alert.id } as const
    mocks.sendStudentAlertEmail.mockRejectedValue(new Error('Brevo HS'))

    const before = Date.now()
    expect(await sendAlertBatch(key, { number: 1, max: 3 })).toEqual({ sent: false, housings: 0, failed: true })
    let jobs = await jobsOf(alert.id)
    expect(jobs.every((j) => j.status === 'pending' && j.attempts === 1 && j.error === 'Brevo HS')).toBe(true)
    expect(jobs[0].sendId).not.toBeNull()
    const queued = await listGraphileJobs()
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ task_identifier: 'send-alert-batch', key: `alert:${alert.id}`, queue_name: 'alert-send' })
    const delay = new Date(queued[0].run_at).getTime() - before
    expect(delay).toBeGreaterThanOrEqual(30 * 60_000)
    expect(delay).toBeLessThan(31 * 60_000)

    await sendAlertBatch(key, { number: 1, max: 3 })
    await clearGraphileJobs()
    expect(await sendAlertBatch(key, { number: 1, max: 3 })).toEqual({ sent: false, housings: 0, failed: true })
    jobs = await jobsOf(alert.id)
    expect(jobs.every((j) => j.status === 'failed' && j.attempts === 3)).toBe(true)
    expect(await listGraphileJobs()).toHaveLength(0)
  })

  it('une ligne arrivée en cours de route garde ses propres tentatives', async () => {
    const { alert, city } = await createAlertWithJobs(['alert'])
    const key = { kind: 'alert', studentAlertId: alert.id } as const
    mocks.sendStudentAlertEmail.mockRejectedValue(new Error('Brevo HS'))
    await sendAlertBatch(key, { number: 1, max: 3 })
    await sendAlertBatch(key, { number: 1, max: 3 })
    const late = await createAccommodation({ cityId: city.id, geom: POINT_INSIDE, published: true, name: 'Tardive' })
    await getTestDb().insert(alertJobs).values({ userId: 'student-1', studentAlertId: alert.id, accommodationId: late.id, source: 'alert' })
    await clearGraphileJobs()

    await sendAlertBatch(key, { number: 1, max: 3 })

    const jobs = await jobsOf(alert.id)
    expect(jobs.map((j) => [j.status, j.attempts])).toEqual([
      ['failed', 3],
      ['pending', 1],
    ])
    expect(await listGraphileJobs()).toHaveLength(1)
  })

  it('erreur inattendue (hors Brevo) : relancée pour les retries Graphile', async () => {
    const { alert } = await createAlertWithJobs(['alert'])
    await getTestDb().execute(sql`alter table alert_job add constraint test_block_send check (send_id is null) not valid`)
    try {
      await expect(sendAlertBatch({ kind: 'alert', studentAlertId: alert.id }, { number: 1, max: 3 })).rejects.toThrow()
    } finally {
      await getTestDb().execute(sql`alter table alert_job drop constraint test_block_send`)
    }
  })

  it('hors production : aucun appel Brevo, lignes inchangées', async () => {
    mocks.env.NEXT_PUBLIC_APP_ENV = 'staging'
    const { alert } = await createAlertWithJobs(['alert'])

    const result = await sendAlertBatch({ kind: 'alert', studentAlertId: alert.id }, { number: 1, max: 3 })

    expect(result).toEqual({ sent: false, housings: 0, failed: false })
    expect(mocks.sendStudentAlertEmail).not.toHaveBeenCalled()
    const [job] = await jobsOf(alert.id)
    expect(job).toMatchObject({ status: 'pending', attempts: 0, sendId: null })
  })
})

describe('tâche send-alert-batch', () => {
  it('trace le job_run avec ses métriques', async () => {
    const { alert } = await createAlertWithJobs(['alert', 'similar'])
    const helpers = { job: { attempts: 1, max_attempts: 3 } } as Parameters<typeof sendAlertBatchTask>[1]

    await sendAlertBatchTask({ kind: 'alert', studentAlertId: alert.id }, helpers)

    const [run] = await getTestDb().select().from(jobRuns)
    expect(run).toMatchObject({
      task: 'send-alert-batch',
      trigger: 'event',
      status: 'done',
      metrics: { emails: 1, housings: 2, failed: 0 },
    })
  })

  it('échec Brevo : la tâche se termine sans lever et compte l’échec', async () => {
    const { alert } = await createAlertWithJobs(['alert'])
    mocks.sendStudentAlertEmail.mockRejectedValue(new Error('Brevo HS'))
    const helpers = { job: { attempts: 1, max_attempts: 3 } } as Parameters<typeof sendAlertBatchTask>[1]

    await expect(sendAlertBatchTask({ kind: 'alert', studentAlertId: alert.id }, helpers)).resolves.toBeUndefined()

    const [run] = await getTestDb().select().from(jobRuns)
    expect(run).toMatchObject({ status: 'done', metrics: { emails: 0, housings: 0, failed: 1 } })
  })
})

describe('report-alert-failures', () => {
  it('un seul mail agrégé pour les lignes épuisées, puis plus rien', async () => {
    const { alert, rows } = await createAlertWithJobs(['alert', 'similar', 'alert'])
    await getTestDb()
      .update(alertJobs)
      .set({ status: 'failed', attempts: 3, error: 'Brevo HS' })
      .where(eq(alertJobs.studentAlertId, alert.id))
    await getTestDb().update(alertJobs).set({ status: 'failed', attempts: 1 }).where(eq(alertJobs.id, rows[2].id))

    expect(await reportAlertFailures()).toBe(2)
    expect(mocks.notifyCronFailure).toHaveBeenCalledTimes(1)
    const [{ job, error }] = mocks.notifyCronFailure.mock.calls[0]
    expect(job).toBe('send-alert-batch')
    expect(error.name).toBe('CronPartialFailure')
    expect(error.message).toBe('2 alerte(s) définitivement non envoyée(s) après 3 tentatives')
    expect(error.details).toHaveLength(2)

    expect(await reportAlertFailures()).toBe(0)
    expect(mocks.notifyCronFailure).toHaveBeenCalledTimes(1)
  })

  it('ne marque rien comme signalé si le mail récapitulatif ne part pas', async () => {
    const { alert } = await createAlertWithJobs(['alert'])
    await getTestDb().update(alertJobs).set({ status: 'failed', attempts: 3 }).where(eq(alertJobs.studentAlertId, alert.id))
    mocks.notifyCronFailure.mockResolvedValueOnce(false)

    expect(await reportAlertFailures()).toBe(0)
    expect((await jobsOf(alert.id))[0].failureReportedAt).toBeNull()

    expect(await reportAlertFailures()).toBe(1)
    expect(mocks.notifyCronFailure).toHaveBeenCalledTimes(2)
  })
})

describe('requeue-pending-alerts', () => {
  it('remet en file les lots pending depuis plus de 10 min', async () => {
    const { alert } = await createAlertWithJobs(['alert', 'similar'])
    const fresh = await createAccommodation({ published: true })
    await createFavoriteAccommodation({ userId: 'student-4', accommodationId: fresh.id })
    await getTestDb().insert(alertJobs).values({ userId: 'student-4', accommodationId: fresh.id, source: 'favorite' })
    await getTestDb()
      .update(alertJobs)
      .set({ createdAt: new Date(Date.now() - 15 * 60_000) })
      .where(eq(alertJobs.studentAlertId, alert.id))

    expect(await requeuePendingAlerts()).toBe(1)
    const jobs = await listGraphileJobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({ task_identifier: 'send-alert-batch', key: `alert:${alert.id}` })

    expect(await requeuePendingAlerts()).toBe(1)
    expect(await listGraphileJobs()).toHaveLength(1)
  })

  it('ne fait rien hors production', async () => {
    mocks.env.NEXT_PUBLIC_APP_ENV = 'staging'
    const { alert } = await createAlertWithJobs(['alert'])
    await getTestDb()
      .update(alertJobs)
      .set({ createdAt: new Date(Date.now() - 15 * 60_000) })
      .where(eq(alertJobs.studentAlertId, alert.id))

    expect(await requeuePendingAlerts()).toBe(0)
    expect(await listGraphileJobs()).toHaveLength(0)
  })
})

describe('flux pull : création d’alerte et backfill', () => {
  it('enqueueJobsForNewAlert met en file le lot de l’alerte', async () => {
    const city = await setupCity()
    await createAccommodation({ cityId: city.id, geom: POINT_INSIDE, published: true, priceMin: 400, nbAvailableApartments: 3 })
    const alert = await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })

    expect(await enqueueJobsForNewAlert(alert.id)).toBe(1)

    const queued = await listGraphileJobs()
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({ task_identifier: 'send-alert-batch', key: `alert:${alert.id}` })
  })

  it('backfillAlertJobs met en file un lot par alerte et par étudiant favori', async () => {
    const city = await setupCity()
    const accom = await createAccommodation({
      cityId: city.id,
      geom: POINT_INSIDE,
      published: true,
      priceMin: 400,
      nbAvailableApartments: 3,
    })
    const alert = await createAlert({ userId: 'student-1', cityId: city.id, maxPrice: 500, receiveNotifications: true })
    await createFavoriteAccommodation({ userId: 'student-2', accommodationId: accom.id })

    expect((await backfillAlertJobs()).jobsCreated).toBe(2)

    const queued = await listGraphileJobs()
    expect(queued.map((j) => j.key).sort()).toEqual([`alert:${alert.id}`, 'favorite:student-2'])
    expect(queued.every((j) => j.task_identifier === 'send-alert-batch')).toBe(true)
  })
})
