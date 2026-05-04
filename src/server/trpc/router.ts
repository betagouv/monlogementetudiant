import { createTRPCRouter } from './init'
import { accommodationsRouter } from './routers/accommodations'
import { adminRouter } from './routers/admin'
import { alertsRouter } from './routers/alerts'
import { bailleurRouter } from './routers/bailleur'
import { dossierFacileRouter } from './routers/dossier-facile'
import { favoritesRouter } from './routers/favorites'
import { ownerFeedbackRouter } from './routers/owner-feedback'
import { ownerStatisticsRouter } from './routers/owner-statistics'
import { questionsAnswersRouter } from './routers/questions-answers'
import { territoriesRouter } from './routers/territories'
import { trackingRouter } from './routers/tracking'

export const appRouter = createTRPCRouter({
  territories: territoriesRouter,
  accommodations: accommodationsRouter,
  bailleur: bailleurRouter,
  favorites: favoritesRouter,
  alerts: alertsRouter,
  questionsAnswers: questionsAnswersRouter,
  admin: adminRouter,
  dossierFacile: dossierFacileRouter,
  tracking: trackingRouter,
  ownerStatistics: ownerStatisticsRouter,
  ownerFeedback: ownerFeedbackRouter,
})

export type AppRouter = typeof appRouter
