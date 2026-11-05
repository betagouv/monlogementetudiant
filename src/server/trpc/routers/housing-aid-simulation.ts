import { desc, eq } from 'drizzle-orm'
import { type HelpSimulatorFormData, helpSimulatorSchema } from '~/components/helps-simulator/help-simulator-schema'
import { db } from '~/server/db'
import { housingAidSimulations } from '~/server/db/schema'
import { isWithinSessionWindow } from '~/server/student/simulation-sessions'
import { createTRPCRouter, userProcedure } from '../init'

export const housingAidSimulationRouter = createTRPCRouter({
  get: userProcedure.query(async ({ ctx }): Promise<HelpSimulatorFormData | null> => {
    const [row] = await db
      .select({ inputs: housingAidSimulations.inputs })
      .from(housingAidSimulations)
      .where(eq(housingAidSimulations.userId, ctx.session.user.id))
      .orderBy(desc(housingAidSimulations.updatedAt))
      .limit(1)

    if (!row) return null

    const parsed = helpSimulatorSchema.safeParse(row.inputs)
    if (!parsed.success) return null

    return parsed.data
  }),

  save: userProcedure.input(helpSimulatorSchema).mutation(async ({ ctx, input }) => {
    const inputs: HelpSimulatorFormData = {
      ...input,
      monthlyRent: typeof input.monthlyRent === 'number' && !Number.isNaN(input.monthlyRent) ? input.monthlyRent : undefined,
    }

    const now = new Date()
    const [latest] = await db
      .select({ id: housingAidSimulations.id, updatedAt: housingAidSimulations.updatedAt })
      .from(housingAidSimulations)
      .where(eq(housingAidSimulations.userId, ctx.session.user.id))
      .orderBy(desc(housingAidSimulations.updatedAt))
      .limit(1)

    if (latest && isWithinSessionWindow(latest.updatedAt, now)) {
      await db.update(housingAidSimulations).set({ inputs, updatedAt: now }).where(eq(housingAidSimulations.id, latest.id))
    } else {
      await db.insert(housingAidSimulations).values({ userId: ctx.session.user.id, inputs })
    }

    return { success: true }
  }),
})
