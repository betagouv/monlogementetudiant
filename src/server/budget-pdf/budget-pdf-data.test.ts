import { describe, expect, it } from 'vitest'
import type { TBudgetSimulation } from '~/schemas/budget-simulation'
import { budgetPdfFileName, buildBudgetPdfData, formatPdfAmount, formatPdfPercent } from '~/server/budget-pdf/budget-pdf-data'

const zeroIncomes = {
  familyAid: 0,
  scholarships: 0,
  cafHousingAid: 0,
  otherPublicAid: 0,
  salary: 0,
  studentLoan: 0,
  other: 0,
  savings: 0,
}

const zeroExpenses = {
  housing: 0,
  housingCharges: 0,
  food: 0,
  dailyLife: 0,
  communication: 0,
  transport: 0,
  registrationFees: 0,
  cvec: 0,
  studyMaterials: 0,
  mutuelle: 0,
  otherHealthcare: 0,
  enjoyment: 0,
  childcare: 0,
  other: 0,
  securityDeposit: 0,
  agencyFees: 0,
  apartmentEquipment: 0,
}

const monthly = <T extends string>(record: Record<T, number>) =>
  Object.fromEntries(Object.keys(record).map((key) => [key, 'monthly'])) as Record<T, 'monthly' | 'yearly'>

const simulation = (overrides: Partial<TBudgetSimulation> = {}): TBudgetSimulation => ({
  monthlyIncomes: { ...zeroIncomes, salary: 600, scholarships: 300 },
  incomeFrequencies: monthly(zeroIncomes),
  monthlyExpenses: { ...zeroExpenses, housing: 400, food: 200, registrationFees: 1200 },
  expenseFrequencies: { ...monthly(zeroExpenses), registrationFees: 'yearly' },
  activeIncomeTypes: ['salary', 'scholarships'],
  activeExpenseTypes: ['housing', 'food', 'registrationFees'],
  ...overrides,
})

describe('buildBudgetPdfData', () => {
  it('garde l’ordre des lignes actives et mensualise les montants annuels', () => {
    const data = buildBudgetPdfData(simulation())
    expect(data.incomes.map((line) => line.type)).toEqual(['salary', 'scholarships'])
    expect(data.expenses.map((line) => line.type)).toEqual(['housing', 'food', 'registrationFees'])
    expect(data.expenses[2]).toEqual({ type: 'registrationFees', frequency: 'yearly', amount: 1200, monthly: 100 })
  })

  it('ignore les montants des catégories inactives', () => {
    const data = buildBudgetPdfData(simulation({ monthlyIncomes: { ...zeroIncomes, salary: 600, scholarships: 300, savings: 5000 } }))
    expect(data.totalIncomes).toBe(900)
  })

  it('calcule les totaux, le solde et le taux d’épargne', () => {
    const data = buildBudgetPdfData(simulation())
    expect(data.totalIncomes).toBe(900)
    expect(data.totalExpenses).toBe(700)
    expect(data.remainingBalance).toBe(200)
    expect(data.savingsRate).toBeCloseTo(22.22, 2)
  })

  it('n’affiche pas de taux d’épargne quand le solde est négatif', () => {
    const data = buildBudgetPdfData(simulation({ activeIncomeTypes: ['salary'] }))
    expect(data.remainingBalance).toBe(-100)
    expect(data.savingsRate).toBeNull()
  })

  it('n’affiche pas de taux d’épargne sans revenus', () => {
    expect(buildBudgetPdfData(simulation({ monthlyIncomes: zeroIncomes })).savingsRate).toBeNull()
  })

  it('trie la répartition par montant décroissant et exclut les dépenses nulles', () => {
    const data = buildBudgetPdfData(simulation({ activeExpenseTypes: ['food', 'transport', 'housing', 'registrationFees'] }))
    expect(data.expenseShares.map((share) => share.type)).toEqual(['housing', 'food', 'registrationFees'])
    expect(data.expenseShares[0]?.share).toBeCloseTo(400 / 700)
    expect(data.expenseShares.reduce((sum, share) => sum + share.share, 0)).toBeCloseTo(1)
  })

  it('renvoie une répartition vide sans dépense', () => {
    expect(buildBudgetPdfData(simulation({ monthlyExpenses: zeroExpenses })).expenseShares).toEqual([])
  })
})

describe('formatage du PDF', () => {
  it('formate les montants sans espace insécable', () => {
    expect(formatPdfAmount(4200)).toBe('4 200,00 €')
    expect(formatPdfAmount(-350)).toBe('-350,00 €')
  })

  it('formate les pourcentages', () => {
    expect(formatPdfPercent(0.5714)).toBe('57,1 %')
  })

  it('date le nom du fichier', () => {
    expect(budgetPdfFileName(new Date('2026-11-02T10:00:00Z'))).toBe('mon-budget-etudiant-2026-11-02.pdf')
  })
})
