import { bigint, integer, pgTable, text, varchar } from 'drizzle-orm/pg-core'

export const questionsAnswers = pgTable('faq_questionanswer', {
  id: bigint({ mode: 'number' }).primaryKey(),
  titleFr: varchar('title_fr', { length: 500 }).notNull(),
  contentFr: text('content_fr').notNull(),
  contentTypeId: integer('content_type_id'),
  objectId: integer('object_id'),
  order: integer('order'),
})
