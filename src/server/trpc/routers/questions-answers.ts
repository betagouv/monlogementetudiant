import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/db'
import { djangoContentType } from '~/server/db/schema/django-content-type'
import { questionsAnswers } from '~/server/db/schema/questions-answers'
import { baseProcedure, createTRPCRouter } from '../init'

function mapQA(row: typeof questionsAnswers.$inferSelect) {
  return {
    id: row.id,
    title_fr: row.titleFr,
    content_fr: row.contentFr,
    content_type: row.contentTypeId,
    object_id: row.objectId,
  }
}

async function getQAByContentType(contentType: string, objectId: number) {
  return db
    .select({
      id: questionsAnswers.id,
      titleFr: questionsAnswers.titleFr,
      contentFr: questionsAnswers.contentFr,
      contentTypeId: questionsAnswers.contentTypeId,
      objectId: questionsAnswers.objectId,
      order: questionsAnswers.order,
    })
    .from(questionsAnswers)
    .innerJoin(djangoContentType, eq(questionsAnswers.contentTypeId, djangoContentType.id))
    .where(and(eq(djangoContentType.model, contentType), eq(questionsAnswers.objectId, objectId)))
    .orderBy(questionsAnswers.order)
}

export const questionsAnswersRouter = createTRPCRouter({
  getByTerritory: baseProcedure
    .input(
      z
        .object({
          content_type: z.string(),
          object_id: z.number(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const franceQA = await getQAByContentType('country', 1)

      if (input?.content_type && input?.object_id) {
        const specificQA = await getQAByContentType(input.content_type, input.object_id)
        if (specificQA.length > 0) {
          return specificQA.map(mapQA)
        }
      }

      return franceQA.map(mapQA)
    }),

  getGlobal: baseProcedure.query(async () => {
    const results = await db
      .select({
        id: questionsAnswers.id,
        titleFr: questionsAnswers.titleFr,
        contentFr: questionsAnswers.contentFr,
        contentTypeId: questionsAnswers.contentTypeId,
        objectId: questionsAnswers.objectId,
        order: questionsAnswers.order,
      })
      .from(questionsAnswers)
      .where(and(isNull(questionsAnswers.contentTypeId), isNull(questionsAnswers.objectId)))
      .orderBy(questionsAnswers.order)

    return results.map((row) => ({
      id: row.id,
      title_fr: row.titleFr,
      content_fr: row.contentFr,
      content_type: row.contentTypeId,
    }))
  }),
})
