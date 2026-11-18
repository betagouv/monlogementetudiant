import { desc, eq } from 'drizzle-orm'
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
      .orderBy(desc(budgetSimulations.updatedAt))
      .limit(1)

    if (!row) return null

    const parsed = ZBudgetSimulation.safeParse(row.inputs)
    if (!parsed.success) return null

    return parsed.data
  }),

  // L'autosave met à jour la version courante ; seule `reset` en ouvre une nouvelle.
  save: userProcedure.input(ZBudgetSimulation).mutation(async ({ ctx, input }) => {
    const [latest] = await db
      .select({ id: budgetSimulations.id })
      .from(budgetSimulations)
      .where(eq(budgetSimulations.userId, ctx.session.user.id))
      .orderBy(desc(budgetSimulations.updatedAt))
      .limit(1)

    if (latest) {
      await db.update(budgetSimulations).set({ inputs: input, updatedAt: new Date() }).where(eq(budgetSimulations.id, latest.id))
    } else {
      await db.insert(budgetSimulations).values({ userId: ctx.session.user.id, inputs: input })
    }

    return { success: true }
  }),

  reset: userProcedure.input(ZBudgetSimulation).mutation(async ({ ctx, input }) => {
    await db.insert(budgetSimulations).values({ userId: ctx.session.user.id, inputs: input })
    return { success: true }
  }),
})
