import { desc, eq } from 'drizzle-orm'
import { type TBudgetSimulation, ZBudgetSimulation } from '~/schemas/budget-simulation'
import { db } from '~/server/db'
import { budgetSimulations } from '~/server/db/schema'
import { isWithinSessionWindow } from '~/server/student/simulation-sessions'
import { createTRPCRouter, userProcedure } from '../init'

export const budgetSimulationRouter = createTRPCRouter({
  get: userProcedure.query(async ({ ctx }): Promise<TBudgetSimulation | null> => {
    const [row] = await db
      .select({ inputs: budgetSimulations.inputs })
      .from(budgetSimulations)
      .where(eq(budgetSimulations.userId, ctx.session.user.id))
      .orderBy(desc(budgetSimulations.updatedAt))
      .limit(1)

    if (!row) return null

    const parsed = ZBudgetSimulation.safeParse(row.inputs)
    if (!parsed.success) return null

    return parsed.data
  }),

  save: userProcedure.input(ZBudgetSimulation).mutation(async ({ ctx, input }) => {
    const now = new Date()
    const [latest] = await db
      .select({ id: budgetSimulations.id, updatedAt: budgetSimulations.updatedAt })
      .from(budgetSimulations)
      .where(eq(budgetSimulations.userId, ctx.session.user.id))
      .orderBy(desc(budgetSimulations.updatedAt))
      .limit(1)

    if (latest && isWithinSessionWindow(latest.updatedAt, now)) {
      await db.update(budgetSimulations).set({ inputs: input, updatedAt: now }).where(eq(budgetSimulations.id, latest.id))
    } else {
      await db.insert(budgetSimulations).values({ userId: ctx.session.user.id, inputs: input })
    }

    return { success: true }
  }),
})
