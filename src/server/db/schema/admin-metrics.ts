import { bigint, index, integer, pgTable, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core'
import { scholarshipStatusEnum } from './auth'

export const applicationFacts = pgTable(
  'application_fact',
  {
    id: varchar('id', { length: 80 }).primaryKey(),
    channel: varchar('channel', { length: 20 }).notNull(),
    ownerId: bigint('owner_id', { mode: 'number' }),
    accommodationId: bigint('accommodation_id', { mode: 'number' }),
    cityId: bigint('city_id', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    scholarshipStatus: scholarshipStatusEnum('scholarship_status'),
    status: text('status').notNull(),
    firstTreatedAt: timestamp('first_treated_at', { withTimezone: true }),
    contactedAt: timestamp('contacted_at', { withTimezone: true }),
    attributedAt: timestamp('attributed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('application_fact_created_at_idx').on(t.createdAt),
    index('application_fact_owner_created_at_idx').on(t.ownerId, t.createdAt),
  ],
)

export const monthlyMetrics = pgTable(
  'monthly_metric',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    month: varchar('month', { length: 7 }).notNull(),
    metric: varchar('metric', { length: 64 }).notNull(),
    scope: varchar('scope', { length: 10 }).notNull(),
    scopeId: bigint('scope_id', { mode: 'number' }).notNull().default(0),
    value: integer('value').notNull(),
    boursiers: integer('boursiers'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('monthly_metric_month_metric_scope_scope_id_unique').on(t.month, t.metric, t.scope, t.scopeId)],
)
