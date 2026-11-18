import { sql } from 'drizzle-orm'
import { bigint, boolean, check, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { accommodations } from './accommodations'
import { user } from './auth'
import { owners } from './owners'

export const scholarshipSurveyAnswers = pgTable(
  'scholarship_survey_answer',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    accommodationId: bigint('accommodation_id', { mode: 'number' })
      .notNull()
      .unique('scholarship_survey_answer_accommodation_id_unique')
      .references(() => accommodations.id, { onDelete: 'cascade' }),
    scholarshipCount: integer('scholarship_count'),
    scholarshipRate: integer('scholarship_rate'),
    notMeasured: boolean('not_measured').notNull().default(false),
    updatedByUserId: text('updated_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('scholarship_survey_answer_count_check', sql`${t.scholarshipCount} >= 0`),
    check('scholarship_survey_answer_rate_check', sql`${t.scholarshipRate} BETWEEN 0 AND 100`),
  ],
)

export const scholarshipSurveyOwners = pgTable('scholarship_survey_owner', {
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  ownerId: bigint('owner_id', { mode: 'number' })
    .notNull()
    .unique('scholarship_survey_owner_owner_id_unique')
    .references(() => owners.id, { onDelete: 'cascade' }),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  completedByUserId: text('completed_by_user_id').references(() => user.id, { onDelete: 'set null' }),
})
