import { createTRPCRouter } from './init'
import { accommodationsRouter } from './routers/accommodations'
import { alertsRouter } from './routers/alerts'
import { bailleurRouter } from './routers/bailleur'
import { favoritesRouter } from './routers/favorites'
import { questionsAnswersRouter } from './routers/questions-answers'
import { territoriesRouter } from './routers/territories'

export const appRouter = createTRPCRouter({
  territories: territoriesRouter,
  accommodations: accommodationsRouter,
  bailleur: bailleurRouter,
  favorites: favoritesRouter,
  alerts: alertsRouter,
  questionsAnswers: questionsAnswersRouter,
})

export type AppRouter = typeof appRouter
