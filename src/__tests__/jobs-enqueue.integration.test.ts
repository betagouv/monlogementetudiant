import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { enqueueJob } from '~/server/jobs/enqueue'
import './helpers/setup-integration'
import { getTestDb } from './helpers/test-db'

type TJobRow = { task_identifier: string; key: string; run_at: Date | string }

const listJobs = async () => {
  const rows = await getTestDb().execute<TJobRow>(sql`select task_identifier, key, run_at from graphile_worker.jobs`)
  return [...rows]
}

describe('enqueueJob', () => {
  it('enqueues a job with its key and run date', async () => {
    const runAt = new Date('2030-01-01T10:00:00.000Z')
    await enqueueJob(getTestDb(), 'detect-alerts', {}, { jobKey: 'k1', runAt })

    const jobs = await listJobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].task_identifier).toBe('detect-alerts')
    expect(jobs[0].key).toBe('k1')
    expect(new Date(jobs[0].run_at).toISOString()).toBe(runAt.toISOString())
  })

  it('keeps the first run date with preserve_run_at', async () => {
    const first = new Date('2030-01-01T10:00:00.000Z')
    const later = new Date('2030-01-02T10:00:00.000Z')
    await enqueueJob(getTestDb(), 'detect-alerts', {}, { jobKey: 'k1', runAt: first })
    await enqueueJob(getTestDb(), 'detect-alerts', {}, { jobKey: 'k1', runAt: later, jobKeyMode: 'preserve_run_at' })

    const jobs = await listJobs()
    expect(jobs).toHaveLength(1)
    expect(new Date(jobs[0].run_at).toISOString()).toBe(first.toISOString())
  })

  it('enqueues nothing when the surrounding transaction is rolled back', async () => {
    await getTestDb()
      .transaction(async (tx) => {
        await enqueueJob(tx, 'detect-alerts', {}, { jobKey: 'k2' })
        throw new Error('rollback')
      })
      .catch(() => undefined)

    expect(await listJobs()).toHaveLength(0)
  })
})
