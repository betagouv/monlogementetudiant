import { eq } from 'drizzle-orm'
import { type TBudgetSimulation, ZBudgetSimulation } from '~/schemas/budget-simulation'
import { db } from '~/server/db'
import { budgetSimulations } from '~/server/db/schema'
import { createTRPCRouter, userProcedure } from '../init'

export const budgetSimulationRouter = createTRPCRouter({
  get: userProcedure.query(async ({ ctx }): Promise<TBudgetSimulation | null> => {
    const [row] = await db
      .select({ inputs: budgetSimulations.inputs })
      .from(budgetSimulations)
      .where(eq(budgetSimulations.userId, ctx.session.user.id))

    if (!row) return null

    const parsed = ZBudgetSimulation.safeParse(row.inputs)
    if (!parsed.success) return null

    return parsed.data
  }),

  save: userProcedure.input(ZBudgetSimulation).mutation(async ({ ctx, input }) => {
    await db
      .insert(budgetSimulations)
      .values({ userId: ctx.session.user.id, inputs: input })
      .onConflictDoUpdate({
        target: budgetSimulations.userId,
        set: { inputs: input, updatedAt: new Date() },
      })

    return { success: true }
  }),
})
