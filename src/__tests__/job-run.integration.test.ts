import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '~/server/db'
import { jobRuns } from '~/server/db/schema'
import { finishJobRun, markInterruptedRuns, markStaleCliRuns, recordJobMetrics, withJobRun } from '~/server/jobs/job-run'
import { cleanTables } from './helpers/test-db'

describe('job_run', () => {
  beforeEach(async () => {
    await cleanTables()
    delete process.env.JOB_RUN_ID
  })

  it('enregistre une exécution réussie et fusionne les métriques', async () => {
    await withJobRun('detect-alerts', 'scheduled', async () => {
      await recordJobMetrics({ a: 1 })
      await recordJobMetrics({ b: 2 })
    })

    const rows = await db.select().from(jobRuns)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ task: 'detect-alerts', trigger: 'scheduled', status: 'done', metrics: { a: 1, b: 2 } })
    expect(rows[0].endedAt).not.toBeNull()
  })

  it('enregistre l’erreur et la relance', async () => {
    await expect(
      withJobRun('detect-alerts', 'event', async () => {
        throw new Error('boum')
      }),
    ).rejects.toThrow('boum')

    const [row] = await db.select().from(jobRuns)
    expect(row).toMatchObject({ status: 'error', error: 'boum' })
    expect(row.endedAt).not.toBeNull()
  })

  it('finishJobRun clôt la ligne d’une commande lancée hors du worker', async () => {
    const [ok] = await db.insert(jobRuns).values({ task: 'sync-stats', trigger: 'scheduled' }).returning({ id: jobRuns.id })
    const [ko] = await db.insert(jobRuns).values({ task: 'sync-rents', trigger: 'scheduled' }).returning({ id: jobRuns.id })

    await finishJobRun(ok.id)
    await finishJobRun(ko.id, new Error('boum'))

    const rows = await db.select().from(jobRuns).orderBy(jobRuns.id)
    expect(rows.map(({ status, error }) => ({ status, error }))).toEqual([
      { status: 'done', error: null },
      { status: 'error', error: 'boum' },
    ])
    expect(rows.every((row) => row.endedAt !== null)).toBe(true)
  })

  it('ne fait rien hors contexte et sans JOB_RUN_ID', async () => {
    await db.insert(jobRuns).values({ task: 't', trigger: 'manual' })
    await recordJobMetrics({ a: 1 })

    const [row] = await db.select().from(jobRuns)
    expect(row.metrics).toEqual({})
  })

  it('écrit dans la ligne désignée par JOB_RUN_ID', async () => {
    const [created] = await db.insert(jobRuns).values({ task: 't', trigger: 'manual' }).returning({ id: jobRuns.id })
    process.env.JOB_RUN_ID = String(created.id)

    await recordJobMetrics({ a: 3 })

    const [row] = await db.select().from(jobRuns).where(eq(jobRuns.id, created.id))
    expect(row.metrics).toEqual({ a: 3 })
  })

  it('passe les exécutions en cours à interrupted', async () => {
    await db.insert(jobRuns).values([
      { task: 'a', trigger: 'manual' },
      { task: 'b', trigger: 'manual', status: 'done' },
    ])

    expect(await markInterruptedRuns()).toBe(1)

    const rows = await db.select().from(jobRuns).orderBy(jobRuns.task)
    expect(rows.map((r) => r.status)).toEqual(['interrupted', 'done'])
    expect(rows[0].endedAt).not.toBeNull()
  })

  it('ne marque pas interrompue une commande CLI, qui tourne dans son propre one-off', async () => {
    await db.insert(jobRuns).values([
      { task: 'import-fac-habitat', trigger: 'scheduled' },
      { task: 'requeue-pending-alerts', trigger: 'scheduled' },
    ])

    expect(await markInterruptedRuns()).toBe(1)

    const rows = await db.select().from(jobRuns).orderBy(jobRuns.task)
    expect(rows.map((r) => [r.task, r.status])).toEqual([
      ['import-fac-habitat', 'running'],
      ['requeue-pending-alerts', 'interrupted'],
    ])
  })

  it('markStaleCliRuns interrompt les commandes restées en cours au-delà de leur délai', async () => {
    const now = new Date('2026-11-17T12:00:00Z')
    const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000)
    await db.insert(jobRuns).values([
      { task: 'import-fac-habitat', trigger: 'scheduled', startedAt: ago(70) },
      { task: 'import-arpej-ibail', trigger: 'scheduled', startedAt: ago(10) },
      { task: 'sync-cities', trigger: 'scheduled', startedAt: ago(120) },
      { task: 'requeue-pending-alerts', trigger: 'scheduled', startedAt: ago(600) },
    ])

    expect(await markStaleCliRuns(now)).toBe(1)

    const rows = await db.select().from(jobRuns).orderBy(jobRuns.task)
    expect(rows.map((r) => [r.task, r.status])).toEqual([
      ['import-arpej-ibail', 'running'],
      ['import-fac-habitat', 'interrupted'],
      ['requeue-pending-alerts', 'running'],
      ['sync-cities', 'running'],
    ])
  })
})
