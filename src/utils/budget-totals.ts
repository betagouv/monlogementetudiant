import type { TBudgetSimulation } from '~/schemas/budget-simulation'
import { getMonthlyEquivalent } from '~/utils/budget-amount'

export function computeBudgetTotals(inputs: TBudgetSimulation) {
  const totalIncomes = inputs.activeIncomeTypes.reduce(
    (sum, type) => sum + getMonthlyEquivalent(inputs.monthlyIncomes[type], inputs.incomeFrequencies[type]),
    0,
  )
  const totalExpenses = inputs.activeExpenseTypes.reduce(
    (sum, type) => sum + getMonthlyEquivalent(inputs.monthlyExpenses[type], inputs.expenseFrequencies[type]),
    0,
  )
  return { totalIncomes, totalExpenses, remainingBalance: totalIncomes - totalExpenses }
}
