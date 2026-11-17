import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { enqueueJob } from '~/server/jobs/enqueue'
import { releaseLocksTakenBefore } from '~/server/jobs/stale-locks'
import './helpers/setup-integration'
import { getTestDb } from './helpers/test-db'

const lock = async (key: string, queue: string, owner: string, lockedAt: string) => {
  const db = getTestDb()
  await enqueueJob(db, 'run-cli-command', { args: [key] }, { jobKey: key, queueName: queue })
  await db.execute(sql`
    update graphile_worker._private_jobs set locked_by = ${owner}, locked_at = ${lockedAt}::timestamptz where key = ${key}`)
  await db.execute(sql`
    update graphile_worker._private_job_queues set locked_by = ${owner}, locked_at = ${lockedAt}::timestamptz where queue_name = ${queue}`)
}

const locks = async () =>
  getTestDb().execute<{ key: string; job_locked: boolean; queue_locked: boolean }>(sql`
    select j.key, j.locked_at is not null as job_locked, q.locked_at is not null as queue_locked
    from graphile_worker._private_jobs j
    join graphile_worker._private_job_queues q on q.id = j.job_queue_id
    order by j.key`)

describe('releaseLocksTakenBefore', () => {
  it('libère les verrous d’une instance précédente et garde ceux de l’instance courante', async () => {
    await lock('ancien', 'cli-commands', 'pool-mort', new Date(Date.now() - 60 * 60_000).toISOString())
    await lock('courant', 'autre-file', 'pool-vivant', new Date().toISOString())

    const released = await releaseLocksTakenBefore(getTestDb(), new Date(Date.now() - 60_000))

    expect(released).toEqual(['pool-mort'])
    expect(await locks()).toEqual([
      { key: 'ancien', job_locked: false, queue_locked: false },
      { key: 'courant', job_locked: true, queue_locked: true },
    ])
  })

  it('ne fait rien sans verrou ancien', async () => {
    expect(await releaseLocksTakenBefore(getTestDb(), new Date())).toEqual([])
  })
})
