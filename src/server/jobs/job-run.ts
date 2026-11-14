import { AsyncLocalStorage } from 'node:async_hooks'
import { eq, sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { jobRuns } from '~/server/db/schema/job-run'

export type TJobRunTrigger = (typeof jobRuns.$inferInsert)['trigger']

const jobRunContext = new AsyncLocalStorage<{ id: number }>()

function currentJobRunId(): number | null {
  const contextId = jobRunContext.getStore()?.id
  if (contextId !== undefined) return contextId
  const envId = Number(process.env.JOB_RUN_ID)
  return Number.isInteger(envId) && envId > 0 ? envId : null
}

export async function withJobRun<T>(task: string, trigger: TJobRunTrigger, fn: () => Promise<T>): Promise<T> {
  const [run] = await db.insert(jobRuns).values({ task, trigger }).returning({ id: jobRuns.id })

  try {
    const result = await jobRunContext.run({ id: run.id }, fn)
    await db.update(jobRuns).set({ status: 'done', endedAt: new Date() }).where(eq(jobRuns.id, run.id))
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await db.update(jobRuns).set({ status: 'error', endedAt: new Date(), error: message }).where(eq(jobRuns.id, run.id))
    throw error
  }
}

export async function recordJobMetrics(metrics: Record<string, number>): Promise<void> {
  const id = currentJobRunId()
  if (id === null) return
  await db
    .update(jobRuns)
    .set({ metrics: sql`${jobRuns.metrics} || ${JSON.stringify(metrics)}::jsonb` })
    .where(eq(jobRuns.id, id))
}

export async function markInterruptedRuns(): Promise<number> {
  const rows = await db
    .update(jobRuns)
    .set({ status: 'interrupted', endedAt: new Date() })
    .where(eq(jobRuns.status, 'running'))
    .returning({ id: jobRuns.id })
  return rows.length
}
