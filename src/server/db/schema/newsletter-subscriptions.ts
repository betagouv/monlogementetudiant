import { bigint, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core'

export const newsletterSubscriptions = pgTable('newsletter_subscription', {
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  email: varchar({ length: 255 }).notNull(),
  payload: jsonb().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})
