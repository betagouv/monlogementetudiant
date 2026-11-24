import { sql } from 'drizzle-orm'
import type { db } from '~/server/db'

export async function releaseLocksTakenBefore(conn: Pick<typeof db, 'execute'>, before: Date): Promise<string[]> {
  const rows = await conn.execute<{ locked_by: string }>(sql`
    select locked_by from graphile_worker._private_jobs where locked_by is not null and locked_at < ${before.toISOString()}::timestamptz
    union
    select locked_by from graphile_worker._private_job_queues where locked_by is not null and locked_at < ${before.toISOString()}::timestamptz
    order by 1`)
  const owners = rows.map((row) => row.locked_by)
  if (owners.length === 0) return []

  await conn.execute(
    sql`select graphile_worker.force_unlock_workers(array[${sql.join(
      owners.map((owner) => sql`${owner}`),
      sql`, `,
    )}]::text[])`,
  )
  return owners
}
