import { createTRPCRouter } from './init'
import { accommodationsRouter } from './routers/accommodations'
import { adminRouter } from './routers/admin'
import { alertsRouter } from './routers/alerts'
import { bailleurRouter } from './routers/bailleur'
import { budgetSimulationRouter } from './routers/budget-simulation'
import { contactsRouter } from './routers/contacts'
import { dossierFacileRouter } from './routers/dossier-facile'
import { favoritesRouter } from './routers/favorites'
import { housingAidSimulationRouter } from './routers/housing-aid-simulation'
import { ownerFeedbackRouter } from './routers/owner-feedback'
import { ownerStatisticsRouter } from './routers/owner-statistics'
import { questionsAnswersRouter } from './routers/questions-answers'
import { studentRouter } from './routers/student'
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
  contacts: contactsRouter,
  tracking: trackingRouter,
  ownerStatistics: ownerStatisticsRouter,
  ownerFeedback: ownerFeedbackRouter,
  student: studentRouter,
  housingAidSimulation: housingAidSimulationRouter,
  budgetSimulation: budgetSimulationRouter,
})

export type AppRouter = typeof appRouter
