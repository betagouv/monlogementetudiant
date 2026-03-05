import { bigint, pgTable, varchar } from 'drizzle-orm/pg-core'

export const owners = pgTable('account_owner', {
  id: bigint({ mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  name: varchar({ length: 200 }).notNull(),
  slug: varchar({ length: 255 }).notNull().unique(),
  url: varchar({ length: 500 }),
})
