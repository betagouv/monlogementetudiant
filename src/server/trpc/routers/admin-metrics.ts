import { z } from 'zod'
import { ZMonth, ZMonthRange } from '~/schemas/admin-metrics/month-range'
import { getCandidaturesSeries } from '~/server/admin-metrics/candidatures'
import { getContactPathSeries, getOwnersToTarget } from '~/server/admin-metrics/contact-path'
import { getOwnerModeration } from '~/server/admin-metrics/moderation'
import { getStudentSeries } from '~/server/admin-metrics/students'
import { getCityMetrics } from '~/server/admin-metrics/territories'
import { adminProcedure, createTRPCRouter } from '../init'

const rangeInput = z.object({ range: ZMonthRange })
const monthInput = z.object({ month: ZMonth })

export const adminMetricsRouter = createTRPCRouter({
  candidatures: adminProcedure.input(rangeInput).query(({ input }) => getCandidaturesSeries(input.range)),
  students: adminProcedure.input(rangeInput).query(({ input }) => getStudentSeries(input.range)),
  contactPath: adminProcedure.input(rangeInput).query(({ input }) => getContactPathSeries(input.range)),
  ownersToTarget: adminProcedure.query(() => getOwnersToTarget()),
  moderation: adminProcedure.input(monthInput).query(({ input }) => getOwnerModeration(input.month)),
  cities: adminProcedure.input(monthInput).query(({ input }) => getCityMetrics(input.month)),
})
