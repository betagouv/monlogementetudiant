import { listE2eReports } from '~/server/services/e2e-reports'
import { adminProcedure, createTRPCRouter } from '../init'

export const adminRecettesRouter = createTRPCRouter({
  list: adminProcedure.query(() => listE2eReports()),
})
