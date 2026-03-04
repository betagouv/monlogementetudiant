import { createTRPCRouter } from './init'
import { accommodationsRouter } from './routers/accommodations'
import { favoritesRouter } from './routers/favorites'
import { questionsAnswersRouter } from './routers/questions-answers'
import { territoriesRouter } from './routers/territories'

export const appRouter = createTRPCRouter({
  territories: territoriesRouter,
  accommodations: accommodationsRouter,
  favorites: favoritesRouter,
  questionsAnswers: questionsAnswersRouter,
})

export type AppRouter = typeof appRouter
