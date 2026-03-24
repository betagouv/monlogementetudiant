import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { getServerSession } from '~/services/better-auth'

export const createTRPCContext = async () => {
  const session = await getServerSession()
  return { session }
}

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

export const userProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.session.user.role === 'owner') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Student or admin role required' })
  }
  return next({ ctx })
})

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.session.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin role required' })
  }
  return next({ ctx })
})
