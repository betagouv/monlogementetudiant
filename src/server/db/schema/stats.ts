import { bigint, date, doublePrecision, integer, jsonb, pgTable, timestamp } from 'drizzle-orm/pg-core'

export const stats = pgTable('stats_stats', {
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  date: date().notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

  uniqueVisitors: integer('unique_visitors'),
  newVisitsPercentage: doublePrecision('new_visits_percentage'),
  averageDuration: doublePrecision('average_duration'),
  bounceRatePercentage: doublePrecision('bounce_rate_percentage'),

  pageViews: integer('page_views'),
  visitorsPerPage: doublePrecision('visitors_per_page'),

  topPages: jsonb('top_pages'),
  mainEntryPages: jsonb('main_entry_pages'),
  mainSources: jsonb('main_sources'),
})
