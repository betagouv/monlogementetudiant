import { createTRPCRouter } from './init'
import { accommodationsRouter } from './routers/accommodations'
import { territoriesRouter } from './routers/territories'

export const appRouter = createTRPCRouter({
  territories: territoriesRouter,
  accommodations: accommodationsRouter,
})

export type AppRouter = typeof appRouter
