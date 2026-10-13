import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { canAccessOwnerSpace, canAccessStudentSpace } from '~/lib/roles'
import { type BailleurPermission, hasPermission, isBailleurAdministrator } from '~/server/bailleur/permissions'
import { getClientIp } from '~/server/contacts/rate-limit'
import { getServerSession } from '~/services/better-auth'
import { maskUnexpectedErrorMessage } from './error-formatter'

/**
 * `opts` est fourni par `fetchRequestHandler` (route HTTP) mais pas par les appels serveur
 * (prefetch RSC, callers de test) : `clientIp` vaut alors `null`.
 */
export const createTRPCContext = async (opts?: { req?: Request }) => {
  const session = await getServerSession()
  return { session, clientIp: getClientIp(opts?.req) }
}

const t = initTRPC.context<Awaited<ReturnType<typeof createTRPCContext>>>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => maskUnexpectedErrorMessage(shape, error, process.env.NODE_ENV === 'production'),
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
  if (!canAccessOwnerSpace(ctx.session.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner or admin role required' })
  }
  return next({ ctx })
})

export const userProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!canAccessStudentSpace(ctx.session.user.role)) {
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

export const bailleurProcedure = (permission: BailleurPermission) =>
  ownerProcedure.use(async ({ ctx, next }) => {
    const u = {
      role: ctx.session.user.role,
      bailleurRole: ctx.session.user.bailleurRole ?? null,
      bailleurPermissions: ctx.session.user.bailleurPermissions ?? [],
    }
    if (!hasPermission(u, permission)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: `Permission denied: ${permission}` })
    }
    return next({ ctx })
  })

export const bailleurAdministratorProcedure = ownerProcedure.use(async ({ ctx, next }) => {
  const u = {
    role: ctx.session.user.role,
    bailleurRole: ctx.session.user.bailleurRole ?? null,
    bailleurPermissions: ctx.session.user.bailleurPermissions ?? [],
  }
  if (!isBailleurAdministrator(u)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Administrateur du bailleur requis' })
  }
  return next({ ctx })
})
