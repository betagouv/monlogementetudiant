import { bigint, date, doublePrecision, integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core'

export const eventStats = pgTable('event_stats', {
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  date: date().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

  category: varchar({ length: 255 }).notNull(),
  action: varchar({ length: 255 }).notNull(),
  nbEvents: integer('nb_events'),
  nbUniqueEvents: integer('nb_unique_events'),
  eventValue: doublePrecision('event_value'),
})
