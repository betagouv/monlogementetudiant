import { desc, eq } from 'drizzle-orm'
import { type HelpSimulatorFormData, helpSimulatorSchema } from '~/components/helps-simulator/help-simulator-schema'
import { db } from '~/server/db'
import { housingAidSimulations } from '~/server/db/schema'
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

  // Pas de mise à jour : chaque enregistrement (acte volontaire) ouvre une nouvelle version.
  save: userProcedure.input(helpSimulatorSchema).mutation(async ({ ctx, input }) => {
    const inputs: HelpSimulatorFormData = {
      ...input,
      monthlyRent: typeof input.monthlyRent === 'number' && !Number.isNaN(input.monthlyRent) ? input.monthlyRent : undefined,
    }

    await db.insert(housingAidSimulations).values({ userId: ctx.session.user.id, inputs })

    return { success: true }
  }),
})
