import { createTRPCRouter } from './init'
import { territoriesRouter } from './routers/territories'

export const appRouter = createTRPCRouter({
  territories: territoriesRouter,
})

export type AppRouter = typeof appRouter
