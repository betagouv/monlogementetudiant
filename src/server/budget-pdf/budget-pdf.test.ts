import { renderToBuffer } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import { DEFAULT_BUDGET_SIMULATOR_STATE } from '~/components/budget-simulation/budget-simulator-context'
import { BudgetPdf, type TBudgetPdfLabels } from '~/server/budget-pdf/budget-pdf'
import { buildBudgetPdfData } from '~/server/budget-pdf/budget-pdf-data'
import fr from '../../../messages/fr.json'

const labels: TBudgetPdfLabels = {
  republic: fr.budgetSimulator.pdf.republic,
  motto: fr.budgetSimulator.pdf.motto,
  serviceName: fr.header.title,
  serviceTagline: fr.header.description,
  title: fr.budgetSimulator.pdf.title,
  generatedOn: 'Simulation générée le 2 novembre 2026',
  totalIncome: fr.budgetSimulator.summary.totalIncome,
  totalExpenses: fr.budgetSimulator.summary.totalExpenses,
  annualTotal: 'Soit 8 400,00 € par an',
  remainingBalance: fr.budgetSimulator.summary.remainingBalance,
  savingsRate: 'Taux d’épargne : 22,2 %',
  incomesTitle: fr.budgetSimulator.pdf.incomesTitle,
  expensesTitle: fr.budgetSimulator.pdf.expensesTitle,
  distributionTitle: fr.budgetSimulator.pdf.distributionTitle,
  columnCategory: fr.budgetSimulator.pdf.columnCategory,
  columnFrequency: fr.budgetSimulator.pdf.columnFrequency,
  columnAmount: fr.budgetSimulator.pdf.columnAmount,
  columnMonthly: fr.budgetSimulator.pdf.columnMonthly,
  total: fr.budgetSimulator.pdf.total,
  empty: fr.budgetSimulator.pdf.empty,
  disclaimer: fr.budgetSimulator.pdf.disclaimer,
  frequencies: fr.budgetSimulator.expenses.frequencies,
  incomeTypes: fr.budgetSimulator.income.types,
  expenseTypes: fr.budgetSimulator.expenses.types,
}

describe('BudgetPdf', () => {
  it('produit un document PDF', async () => {
    const state = {
      ...DEFAULT_BUDGET_SIMULATOR_STATE,
      monthlyIncomes: { ...DEFAULT_BUDGET_SIMULATOR_STATE.monthlyIncomes, salary: 600, scholarships: 300 },
      monthlyExpenses: { ...DEFAULT_BUDGET_SIMULATOR_STATE.monthlyExpenses, housing: 400, food: 200, transport: 30 },
    }
    const buffer = await renderToBuffer(BudgetPdf({ data: buildBudgetPdfData(state), labels }))
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
