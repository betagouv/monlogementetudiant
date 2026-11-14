import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '~/server/db'
import { importJobs } from '~/server/db/schema/import-jobs'
import { jobRuns } from '~/server/db/schema/job-run'
import { createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { adminCaller, authenticatedCaller } from './helpers/test-caller'

beforeEach(async () => {
  await db.delete(importJobs)
  await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })
})

const find = async (identifier: string) => (await adminCaller.admin.jobRuns.overview()).find((item) => item.identifier === identifier)

describe('admin.jobRuns.overview', () => {
  it('utilise la dernière ligne job_run quand elle existe', async () => {
    await db.insert(jobRuns).values([
      { task: 'sync-rents', trigger: 'scheduled', status: 'error', startedAt: new Date('2026-11-01T04:00:00Z') },
      { task: 'sync-rents', trigger: 'scheduled', status: 'done', startedAt: new Date('2026-11-10T04:00:00Z'), metrics: { updated: 3 } },
    ])
    await db.insert(importJobs).values({ type: 'sync-rents', status: 'error', createdBy: 'cron' })

    const item = await find('sync-rents')
    expect(item?.last).toMatchObject({ source: 'job_run', status: 'done', metrics: { updated: 3 } })
    expect(item?.nextRunAt).toBeInstanceOf(Date)
  })

  it('se replie sur import_job sans job_run', async () => {
    const [job] = await db
      .insert(importJobs)
      .values({ type: 'sync-rents', status: 'done', createdBy: 'cron', summary: { updated: 5, errors: ['x'] } })
      .returning()

    const item = await find('sync-rents')
    expect(item?.last).toMatchObject({ source: 'import_job', importJobId: job!.id, status: 'done', metrics: { updated: 5, errors: 1 } })
  })

  it('renvoie last: null sans aucune exécution', async () => {
    expect((await find('purge-logs'))?.last).toBeNull()
  })

  it('liste les tâches déclenchées par événement, sans planification, avec leur dernière exécution', async () => {
    await db.insert(jobRuns).values([
      { task: 'send-alert-batch', trigger: 'event', status: 'done', startedAt: new Date('2026-11-10T04:00:00Z'), metrics: { emails: 1 } },
      { task: 'send-alert-batch', trigger: 'event', status: 'error', startedAt: new Date('2026-11-11T04:00:00Z') },
    ])

    const sendAlert = await find('send-alert-batch')
    expect(sendAlert).toMatchObject({ trigger: 'event', cron: null, nextRunAt: null, last: { status: 'error', source: 'job_run' } })
    expect(await find('detect-alerts')).toMatchObject({ trigger: 'event', cron: null, nextRunAt: null, last: null })
    expect(await find('sync-rents')).toMatchObject({ trigger: 'scheduled', cron: '0 4 1 */3 *' })
  })

  it('ignore les exécutions de tâches inconnues', async () => {
    await db.insert(jobRuns).values({ task: 'tache-retiree', trigger: 'manual', status: 'done' })
    expect(await find('tache-retiree')).toBeUndefined()
  })

  it('refuse un non-admin', async () => {
    await expect(authenticatedCaller.admin.jobRuns.overview()).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('admin.jobRuns.history', () => {
  it('filtre par tâche et pagine par 20, plus récent en premier', async () => {
    const base = new Date('2026-11-01T00:00:00Z').getTime()
    await db.insert(jobRuns).values([
      ...Array.from({ length: 25 }, (_, i) => ({
        task: 'backup-db',
        trigger: 'scheduled' as const,
        startedAt: new Date(base + i * 60_000),
      })),
      { task: 'purge-logs', trigger: 'scheduled' as const },
    ])

    const first = await adminCaller.admin.jobRuns.history({ identifier: 'backup-db', page: 1 })
    expect(first).toMatchObject({ total: 25, pageCount: 2, page: 1 })
    expect(first.items).toHaveLength(20)
    expect(first.items.every((run) => run.task === 'backup-db')).toBe(true)
    expect(first.items[0]!.startedAt.getTime()).toBe(base + 24 * 60_000)

    const second = await adminCaller.admin.jobRuns.history({ identifier: 'backup-db', page: 2 })
    expect(second.items).toHaveLength(5)
  })

  it('refuse un non-admin', async () => {
    await expect(authenticatedCaller.admin.jobRuns.history({ identifier: 'backup-db', page: 1 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})

describe('admin.jobRuns.dailyTotals', () => {
  it('additionne les exécutions et les compteurs d’une même journée à Paris', async () => {
    await db.insert(jobRuns).values([
      {
        task: 'send-alert-batch',
        trigger: 'event',
        status: 'done',
        startedAt: new Date('2026-11-12T08:00:00Z'),
        metrics: { emails: 1, housings: 3, failed: 0 },
      },
      {
        task: 'send-alert-batch',
        trigger: 'event',
        status: 'error',
        startedAt: new Date('2026-11-12T15:00:00Z'),
        metrics: { emails: 0, housings: 2, failed: 1 },
      },
      { task: 'detect-alerts', trigger: 'event', status: 'done', startedAt: new Date('2026-11-12T09:00:00Z'), metrics: { triggered: 9 } },
    ])

    const result = await adminCaller.admin.jobRuns.dailyTotals({ identifier: 'send-alert-batch', page: 1 })

    expect(result).toMatchObject({ total: 1, page: 1, pageCount: 1 })
    expect(result.items).toEqual([{ day: '2026-11-12', runs: 2, errors: 1, metrics: { emails: 1, housings: 5, failed: 1 } }])
  })

  it('sépare les exécutions de part et d’autre de minuit à Paris, plus récent en premier', async () => {
    await db.insert(jobRuns).values([
      { task: 'detect-alerts', trigger: 'event', status: 'done', startedAt: new Date('2026-11-13T22:30:00Z'), metrics: { triggered: 2 } },
      { task: 'detect-alerts', trigger: 'event', status: 'done', startedAt: new Date('2026-11-13T23:30:00Z'), metrics: { triggered: 5 } },
    ])

    const { items } = await adminCaller.admin.jobRuns.dailyTotals({ identifier: 'detect-alerts', page: 1 })

    expect(items).toEqual([
      { day: '2026-11-14', runs: 1, errors: 0, metrics: { triggered: 5 } },
      { day: '2026-11-13', runs: 1, errors: 0, metrics: { triggered: 2 } },
    ])
  })

  it('pagine par 30 jours', async () => {
    await db.insert(jobRuns).values(
      Array.from({ length: 35 }, (_, i) => ({
        task: 'detect-alerts',
        trigger: 'event' as const,
        status: 'done' as const,
        startedAt: new Date(Date.UTC(2026, 8, 1 + i, 10)),
      })),
    )

    const first = await adminCaller.admin.jobRuns.dailyTotals({ identifier: 'detect-alerts', page: 1 })
    const second = await adminCaller.admin.jobRuns.dailyTotals({ identifier: 'detect-alerts', page: 2 })

    expect(first).toMatchObject({ total: 35, pageCount: 2 })
    expect(first.items).toHaveLength(30)
    expect(first.items[0]).toMatchObject({ day: '2026-10-05', runs: 1, metrics: {} })
    expect(second.items).toHaveLength(5)
    expect(second.items.at(-1)?.day).toBe('2026-09-01')
  })

  it('refuse un non-admin', async () => {
    await expect(authenticatedCaller.admin.jobRuns.dailyTotals({ identifier: 'detect-alerts', page: 1 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})
