import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { ZOwnerFeedbackSubmit } from '~/schemas/owner-feedback'
import { db } from '~/server/db'
import { ownerFeedback } from '~/server/db/schema/owner-feedback'
import { createTRPCRouter, protectedProcedure } from '../init'

const ownerFeedbackProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const { role, bailleurRole } = ctx.session.user
  if (role === 'admin' || !bailleurRole) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner feedback is reserved to bailleur users' })
  }
  return next({ ctx })
})

export const ownerFeedbackRouter = createTRPCRouter({
  getStatus: ownerFeedbackProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id
    const row = await db.query.ownerFeedback.findFirst({
      where: eq(ownerFeedback.userId, userId),
      columns: { status: true },
    })
    return { status: row?.status ?? null }
  }),

  submit: ownerFeedbackProcedure.input(ZOwnerFeedbackSubmit).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id
    const [row] = await db
      .insert(ownerFeedback)
      .values({
        userId,
        status: 'submitted',
        rating: input.rating,
        comment: input.comment,
      })
      .onConflictDoUpdate({
        target: ownerFeedback.userId,
        set: {
          status: 'submitted',
          rating: input.rating,
          comment: input.comment,
          updatedAt: new Date(),
        },
      })
      .returning()
    return row
  }),

  snooze: ownerFeedbackProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id
    const [row] = await db
      .insert(ownerFeedback)
      .values({
        userId,
        status: 'snoozed',
      })
      .onConflictDoUpdate({
        target: ownerFeedback.userId,
        set: {
          status: 'snoozed',
          updatedAt: new Date(),
        },
      })
      .returning()
    return row
  }),
})
