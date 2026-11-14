import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '~/server/db'
import { jobRuns } from '~/server/db/schema'
import { markInterruptedRuns, recordJobMetrics, withJobRun } from '~/server/jobs/job-run'
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
})
