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
