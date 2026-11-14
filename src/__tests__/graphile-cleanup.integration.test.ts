import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { jobRuns } from '~/server/db/schema'
import { enqueueJob } from '~/server/jobs/enqueue'
import { graphileCleanupTask } from '~/server/jobs/tasks/graphile-cleanup'
import './helpers/setup-integration'
import { getTestDb } from './helpers/test-db'

const remainingKeys = async () => {
  const rows = await getTestDb().execute<{ key: string }>(sql`select key from graphile_worker._private_jobs order by key`)
  return rows.map((row) => row.key)
}

describe('graphile-cleanup', () => {
  it('supprime les jobs en échec définitif, garde les autres et journalise le run', async () => {
    const db = getTestDb()
    await enqueueJob(db, 'send-alert-batch', { kind: 'favorite', userId: 'a' }, { jobKey: 'permafailed', maxAttempts: 1 })
    await enqueueJob(db, 'send-alert-batch', { kind: 'favorite', userId: 'b' }, { jobKey: 'pending', maxAttempts: 3 })
    await db.execute(sql`update graphile_worker._private_jobs set attempts = max_attempts where key = 'permafailed'`)

    await graphileCleanupTask({}, {} as Parameters<typeof graphileCleanupTask>[1])

    expect(await remainingKeys()).toEqual(['pending'])
    const runs = await db.select().from(jobRuns)
    expect(runs).toMatchObject([{ task: 'graphile-cleanup', trigger: 'scheduled', status: 'done' }])
  })

  it('conserve les identifiants de tâches du worker même sans job', async () => {
    const db = getTestDb()
    await enqueueJob(db, 'detect-alerts', { accommodationIds: [1] }, { jobKey: 'x' })
    await db.execute(sql`delete from graphile_worker._private_jobs`)

    await graphileCleanupTask({}, {} as Parameters<typeof graphileCleanupTask>[1])

    const tasks = await db.execute<{ identifier: string }>(
      sql`select identifier from graphile_worker._private_tasks where identifier = 'detect-alerts'`,
    )
    expect(tasks).toHaveLength(1)
  })
})
