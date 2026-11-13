import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { ZScholarshipSurveySaveInput } from '~/schemas/scholarship-survey'
import { getAccommodationScope } from '~/server/bailleur/accommodation-scope'
import { getOwnerForUser } from '~/server/bailleur/get-owner-for-user'
import { isScholarshipSurveyActive } from '~/server/scholarship-survey/active'
import { getSurveyResidences, isOwnerSurveyCompleted, saveSurveyAnswers, submitSurveyAnswers } from '~/server/scholarship-survey/service'
import { bailleurProcedure, createTRPCRouter } from '../init'

const surveyProcedure = bailleurProcedure('manage_residences').use(async ({ next }) => {
  if (!isScholarshipSurveyActive()) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'L’enquête est terminée' })
  }
  return next()
})

async function resolveSurveyContext(userId: string, ownerId: number | undefined) {
  const owner = await getOwnerForUser(userId, ownerId)
  if (!owner) throw new TRPCError({ code: 'NOT_FOUND', message: 'Bailleur introuvable' })
  return { ownerId: owner.id, scope: await getAccommodationScope(userId) }
}

export const scholarshipSurveyRouter = createTRPCRouter({
  getForm: surveyProcedure.input(z.object({ ownerId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    const { ownerId, scope } = await resolveSurveyContext(ctx.session.user.id, input.ownerId)
    const [residences, ownerCompleted] = await Promise.all([getSurveyResidences(ownerId, scope), isOwnerSurveyCompleted(ownerId)])
    return { residences, ownerCompleted }
  }),

  save: surveyProcedure.input(ZScholarshipSurveySaveInput).mutation(async ({ ctx, input }) => {
    const { ownerId, scope } = await resolveSurveyContext(ctx.session.user.id, input.ownerId)
    await saveSurveyAnswers({ ownerId, scope, userId: ctx.session.user.id, answers: input.answers })
  }),

  submit: surveyProcedure.input(ZScholarshipSurveySaveInput).mutation(async ({ ctx, input }) => {
    const { ownerId, scope } = await resolveSurveyContext(ctx.session.user.id, input.ownerId)
    return submitSurveyAnswers({ ownerId, scope, userId: ctx.session.user.id, answers: input.answers })
  }),
})
