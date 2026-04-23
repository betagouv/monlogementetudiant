import { bigint, pgTable, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core'

export const importBlocklist = pgTable(
  'accommodation_importblocklist',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
    source: varchar({ length: 100 }).notNull(),
    sourceId: varchar('source_id', { length: 100 }).notNull(),
    reason: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.source, t.sourceId)],
)
