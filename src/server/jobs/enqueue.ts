import { sql } from 'drizzle-orm'
import type { db } from '~/server/db'

export const JOB_IDENTIFIERS = [
  'run-cli-command',
  'send-alert-batch',
  'detect-alerts',
  'requeue-pending-alerts',
  'report-alert-failures',
  'brevo-unblock-managers',
  'graphile-cleanup',
] as const

export type TJobIdentifier = (typeof JOB_IDENTIFIERS)[number]

export type TEnqueueOptions = {
  jobKey?: string
  jobKeyMode?: 'replace' | 'preserve_run_at'
  runAt?: Date
  maxAttempts?: number
  queueName?: string
}

export async function enqueueJob(
  conn: Pick<typeof db, 'execute'>,
  identifier: TJobIdentifier,
  payload: Record<string, unknown>,
  options: TEnqueueOptions = {},
): Promise<void> {
  await conn.execute(sql`
    select graphile_worker.add_job(
      identifier => ${identifier}::text,
      payload => ${JSON.stringify(payload)}::json,
      queue_name => ${options.queueName ?? null}::text,
      run_at => ${options.runAt ? options.runAt.toISOString() : null}::timestamptz,
      max_attempts => ${options.maxAttempts ?? null}::int,
      job_key => ${options.jobKey ?? null}::text,
      priority => null,
      flags => null,
      job_key_mode => ${options.jobKeyMode ?? 'replace'}::text
    )
  `)
}
