import { type HelpSimulatorFormData, helpSimulatorSchema } from '~/components/helps-simulator/help-simulator-schema'
import { ZBudgetSimulation } from '~/schemas/budget-simulation'
import { db } from '~/server/db'
import { budgetSimulations, housingAidSimulations } from '~/server/db/schema'
import { computeBudgetTotals } from '~/utils/budget-totals'
import { adminProcedure, createTRPCRouter } from '../init'

const HOUSING_AID_STATUSES = ['student', 'apprentice', 'employed-student', 'lyceen', 'boursier-crous'] as const
type HousingAidStatus = (typeof HOUSING_AID_STATUSES)[number]

const average = (values: number[]) => (values.length === 0 ? null : Math.round(values.reduce((sum, v) => sum + v, 0) / values.length))

// Les inputs invalides (anciens formats) sont ignorés plutôt que de faire échouer la page.
export const adminSimulationsRouter = createTRPCRouter({
  overview: adminProcedure.query(async () => {
    const [budgetRows, housingRows] = await Promise.all([
      db.select({ inputs: budgetSimulations.inputs }).from(budgetSimulations),
      db.select({ inputs: housingAidSimulations.inputs }).from(housingAidSimulations),
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

    // Statut multi-choix : une simulation compte dans chaque ligne, la somme dépasse le total.
    const housingInputs: HelpSimulatorFormData[] = housingRows
      .map((row) => helpSimulatorSchema.safeParse(row.inputs))
      .filter((parsed) => parsed.success)
      .map((parsed) => parsed.data)

    const byStatus = HOUSING_AID_STATUSES.map((status: HousingAidStatus) => {
      const simulations = housingInputs.filter((inputs) => inputs.status.includes(status))
      const rents = simulations
        .map((inputs) => inputs.monthlyRent)
        .filter((rent): rent is number => typeof rent === 'number' && !Number.isNaN(rent))
      return {
        status,
        count: simulations.length,
        averageIncome: average(simulations.map((inputs) => inputs.monthlyIncome)),
        averageRent: average(rents),
        guarantorRate:
          simulations.length === 0
            ? null
            : Math.round((simulations.filter((inputs) => inputs.hasGuarantor === 'yes').length / simulations.length) * 100),
      }
    }).filter((row) => row.count > 0)

    return { budget, housingAid: { count: housingInputs.length, byStatus } }
  }),
})
