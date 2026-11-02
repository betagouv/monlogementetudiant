import type { TBudgetFrequency, TBudgetSimulation } from '~/schemas/budget-simulation'
import { getMonthlyEquivalent } from '~/utils/budget-amount'

export type TBudgetPdfLine<T extends string> = {
  type: T
  frequency: TBudgetFrequency
  amount: number
  monthly: number
}

export type TBudgetPdfShare<T extends string> = { type: T; monthly: number; share: number }

type TIncomeType = TBudgetSimulation['activeIncomeTypes'][number]
type TExpenseType = TBudgetSimulation['activeExpenseTypes'][number]

export type TBudgetPdfData = {
  incomes: TBudgetPdfLine<TIncomeType>[]
  expenses: TBudgetPdfLine<TExpenseType>[]
  totalIncomes: number
  totalExpenses: number
  remainingBalance: number
  savingsRate: number | null
  expenseShares: TBudgetPdfShare<TExpenseType>[]
}

const toLines = <T extends string>(types: readonly T[], amounts: Record<T, number>, frequencies: Record<T, TBudgetFrequency>) =>
  types.map((type) => ({
    type,
    frequency: frequencies[type],
    amount: amounts[type],
    monthly: getMonthlyEquivalent(amounts[type], frequencies[type]),
  }))

const sumMonthly = (lines: { monthly: number }[]) => lines.reduce((sum, line) => sum + line.monthly, 0)

export const buildBudgetPdfData = (simulation: TBudgetSimulation): TBudgetPdfData => {
  const incomes = toLines(simulation.activeIncomeTypes, simulation.monthlyIncomes, simulation.incomeFrequencies)
  const expenses = toLines(simulation.activeExpenseTypes, simulation.monthlyExpenses, simulation.expenseFrequencies)
  const totalIncomes = sumMonthly(incomes)
  const totalExpenses = sumMonthly(expenses)
  const remainingBalance = totalIncomes - totalExpenses

  const expenseShares =
    totalExpenses > 0
      ? expenses
          .filter((line) => line.monthly > 0)
          .map((line) => ({ type: line.type, monthly: line.monthly, share: line.monthly / totalExpenses }))
          .sort((a, b) => b.monthly - a.monthly)
      : []

  return {
    incomes,
    expenses,
    totalIncomes,
    totalExpenses,
    remainingBalance,
    savingsRate: totalIncomes > 0 && remainingBalance >= 0 ? (remainingBalance / totalIncomes) * 100 : null,
    expenseShares,
  }
}

export const formatPdfAmount = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount).replaceAll(' ', ' ').replaceAll(' ', ' ')

export const formatPdfPercent = (ratio: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(ratio * 100)} %`

export const budgetPdfFileName = (date: Date) => `mon-budget-etudiant-${date.toISOString().slice(0, 10)}.pdf`
