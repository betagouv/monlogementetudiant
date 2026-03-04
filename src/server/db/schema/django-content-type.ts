import { integer, pgTable, varchar } from 'drizzle-orm/pg-core'

export const djangoContentType = pgTable('django_content_type', {
  id: integer().primaryKey(),
  appLabel: varchar('app_label', { length: 100 }).notNull(),
  model: varchar({ length: 100 }).notNull(),
})
