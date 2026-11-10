import { z } from 'zod'
import { getSurveyStats, listSurveyRows, SURVEY_STATUS_FILTERS } from '~/server/scholarship-survey/admin'
import { adminProcedure, createTRPCRouter } from '../init'

export const adminScholarshipSurveyRouter = createTRPCRouter({
  list: adminProcedure
    .input(
      z.object({
        status: z.enum(SURVEY_STATUS_FILTERS).default('all'),
        search: z.string().max(200).optional(),
        page: z.number().int().positive().default(1),
      }),
    )
    .query(({ input }) => listSurveyRows(input)),

  stats: adminProcedure.query(() => getSurveyStats()),
})
