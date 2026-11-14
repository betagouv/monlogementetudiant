import { sql } from 'drizzle-orm'
import { bigint, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { accommodations } from './accommodations'
import { user } from './auth'
import { studentAlerts } from './student-alerts'

export const alertJobStatusEnum = pgEnum('alert_job_status', ['pending', 'sent', 'failed'])
export const alertJobSourceEnum = pgEnum('alert_job_source', ['alert', 'favorite', 'similar'])

export const alertJobs = pgTable(
  'alert_job',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // null pour les jobs issus d'un favori (source = 'favorite')
    studentAlertId: bigint('student_alert_id', { mode: 'number' }).references(() => studentAlerts.id, {
      onDelete: 'cascade',
    }),
    accommodationId: bigint('accommodation_id', { mode: 'number' })
      .notNull()
      .references(() => accommodations.id, { onDelete: 'cascade' }),
    source: alertJobSourceEnum().notNull().default('alert'),
    status: alertJobStatusEnum().notNull().default('pending'),
    attempts: integer().notNull().default(0),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    error: text(),
    sendId: uuid('send_id'),
    failureReportedAt: timestamp('failure_reported_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('alert_job_user_id_idx').on(t.userId),
    index('alert_job_status_idx').on(t.status),
    uniqueIndex('alert_job_alert_active_unique')
      .on(t.userId, t.studentAlertId, t.accommodationId)
      .where(sql`${t.source} = 'alert' AND (${t.status} = 'pending' OR (${t.status} = 'failed' AND ${t.attempts} < 3))`),
    uniqueIndex('alert_job_similar_active_unique')
      .on(t.userId, t.studentAlertId, t.accommodationId)
      .where(sql`${t.source} = 'similar' AND (${t.status} = 'pending' OR (${t.status} = 'failed' AND ${t.attempts} < 3))`),
    uniqueIndex('alert_job_favorite_active_unique')
      .on(t.userId, t.accommodationId)
      .where(sql`${t.source} = 'favorite' AND (${t.status} = 'pending' OR (${t.status} = 'failed' AND ${t.attempts} < 3))`),
  ],
)
