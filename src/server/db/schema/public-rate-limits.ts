import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** Compteurs atomiques pour les endpoints publics susceptibles d'être spammés. */
export const publicRateLimits = pgTable('public_rate_limit', {
  key: text().primaryKey(),
  count: integer().notNull().default(1),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
