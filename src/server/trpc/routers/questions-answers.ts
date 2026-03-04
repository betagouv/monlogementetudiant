import { db } from '~/server/db'
import { questionsAnswers } from '~/server/db/schema/questions-answers'
import { baseProcedure, createTRPCRouter } from '../init'

export const questionsAnswersRouter = createTRPCRouter({
  getGlobal: baseProcedure.query(async () => {
    const results = await db
      .select({
        id: questionsAnswers.id,
        titleFr: questionsAnswers.titleFr,
        contentFr: questionsAnswers.contentFr,
        order: questionsAnswers.order,
      })
      .from(questionsAnswers)
      .orderBy(questionsAnswers.order)

    return results.map((row) => ({
      id: row.id,
      title_fr: row.titleFr,
      content_fr: row.contentFr,
    }))
  }),
})
