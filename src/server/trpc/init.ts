import { initTRPC, TRPCError } from '@trpc/server'
import { cache } from 'react'
import superjson from 'superjson'
import { getServerSession } from '~/auth'

export const createTRPCContext = cache(async () => {
  const session = await getServerSession()
  return { session }
})

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create({
  transformer: superjson,
})

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory
export const baseProcedure = t.procedure
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, session: ctx.session } })
})

export const ownerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.session.user.role === 'user') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner or admin role required' })
  }
  return next({ ctx })
})
