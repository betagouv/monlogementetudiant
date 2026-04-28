import { index, integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import type { TImportJobStatus, TImportJobSummary, TImportJobType } from '~/schemas/import-jobs'

export const importJobs = pgTable(
  'import_jobs',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    type: varchar({ length: 20 }).notNull().$type<TImportJobType>(),
    status: varchar({ length: 20 }).notNull().$type<TImportJobStatus>(),
    source: varchar({ length: 100 }),
    createdBy: text('created_by').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    summary: jsonb().$type<TImportJobSummary>(),
  },
  (table) => [index('import_jobs_created_at_idx').on(table.createdAt)],
)
