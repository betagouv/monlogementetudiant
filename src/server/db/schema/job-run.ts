import { sql } from 'drizzle-orm'
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const jobRunTriggerEnum = pgEnum('job_run_trigger', ['scheduled', 'event', 'manual'])
export const jobRunStatusEnum = pgEnum('job_run_status', ['running', 'done', 'error', 'interrupted'])

export const jobRuns = pgTable(
  'job_run',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    task: varchar({ length: 100 }).notNull(),
    trigger: jobRunTriggerEnum().notNull(),
    status: jobRunStatusEnum().notNull().default('running'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    error: text(),
    metrics: jsonb().$type<Record<string, number>>().notNull().default({}),
  },
  (t) => [index('job_run_task_started_at_idx').on(t.task, sql`${t.startedAt} desc`)],
)
