import { bigint, integer, pgTable, text, varchar } from 'drizzle-orm/pg-core'

export const questionsAnswers = pgTable('faq_question_answer', {
  id: bigint({ mode: 'number' }).primaryKey(),
  titleFr: varchar('title_fr', { length: 500 }).notNull(),
  contentFr: text('content_fr').notNull(),
  order: integer('order'),
})
