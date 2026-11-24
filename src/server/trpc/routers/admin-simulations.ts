import { eq } from 'drizzle-orm'
import { helpSimulatorSchema } from '~/components/helps-simulator/help-simulator-schema'
import { ZBudgetSimulation } from '~/schemas/budget-simulation'
import { groupSimulationsByCity, summarizeByStatus, summarizeSimulations } from '~/server/admin/simulations-by-city'
import { db } from '~/server/db'
import { budgetSimulations, cities, housingAidSimulations } from '~/server/db/schema'
import { computeBudgetTotals } from '~/utils/budget-totals'
import { adminProcedure, createTRPCRouter } from '../init'

const average = (values: number[]) => (values.length === 0 ? null : Math.round(values.reduce((sum, v) => sum + v, 0) / values.length))

// Les inputs invalides (anciens formats) sont ignorés plutôt que de faire échouer la page.
export const adminSimulationsRouter = createTRPCRouter({
  overview: adminProcedure.query(async () => {
    const [budgetRows, housingRows, universityCities] = await Promise.all([
      db.select({ inputs: budgetSimulations.inputs }).from(budgetSimulations),
      db.select({ userId: housingAidSimulations.userId, inputs: housingAidSimulations.inputs }).from(housingAidSimulations),
      db.select({ name: cities.name, popular: cities.popular }).from(cities).where(eq(cities.popular, true)),
    ])

    const budgetTotals = budgetRows
      .map((row) => ZBudgetSimulation.safeParse(row.inputs))
      .filter((parsed) => parsed.success)
      .map((parsed) => computeBudgetTotals(parsed.data))

    const budget = {
      count: budgetTotals.length,
      averageIncomes: average(budgetTotals.map((t) => t.totalIncomes)),
      averageExpenses: average(budgetTotals.map((t) => t.totalExpenses)),
      averageBalance: average(budgetTotals.map((t) => t.remainingBalance)),
    }

    const housingSimulations = housingRows.flatMap((row) => {
      const parsed = helpSimulatorSchema.safeParse(row.inputs)
      return parsed.success ? [{ userId: row.userId, inputs: parsed.data }] : []
    })

    return {
      budget,
      housingAid: {
        ...summarizeSimulations(housingSimulations),
        byStatus: summarizeByStatus(housingSimulations),
        // Seules les grandes villes universitaires (villes « populaires » du référentiel) sont signalées.
        byCity: groupSimulationsByCity(housingSimulations, universityCities),
      },
    }
  }),
})
