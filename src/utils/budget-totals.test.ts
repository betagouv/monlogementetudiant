import { describe, expect, it } from 'vitest'
import type { TBudgetSimulation } from '~/schemas/budget-simulation'
import { computeBudgetTotals } from './budget-totals'

const base: TBudgetSimulation = {
  monthlyIncomes: {
    familyAid: 100,
    scholarships: 0,
    cafHousingAid: 0,
    otherPublicAid: 0,
    salary: 600,
    studentLoan: 0,
    other: 999,
    savings: 0,
  },
  monthlyExpenses: {
    housing: 500,
    housingCharges: 0,
    food: 150,
    dailyLife: 0,
    communication: 0,
    transport: 0,
    registrationFees: 0,
    cvec: 120,
    studyMaterials: 0,
    mutuelle: 0,
    otherHealthcare: 0,
    enjoyment: 0,
    childcare: 0,
    other: 777,
    securityDeposit: 0,
    agencyFees: 0,
    apartmentEquipment: 0,
  },
  incomeFrequencies: {
    familyAid: 'monthly',
    scholarships: 'monthly',
    cafHousingAid: 'monthly',
    otherPublicAid: 'monthly',
    salary: 'monthly',
    studentLoan: 'monthly',
    other: 'monthly',
    savings: 'monthly',
  },
  expenseFrequencies: {
    housing: 'monthly',
    housingCharges: 'monthly',
    food: 'monthly',
    dailyLife: 'monthly',
    communication: 'monthly',
    transport: 'monthly',
    registrationFees: 'yearly',
    cvec: 'yearly',
    studyMaterials: 'monthly',
    mutuelle: 'monthly',
    otherHealthcare: 'monthly',
    enjoyment: 'monthly',
    childcare: 'monthly',
    other: 'monthly',
    securityDeposit: 'yearly',
    agencyFees: 'yearly',
    apartmentEquipment: 'yearly',
  },
  activeIncomeTypes: ['salary', 'familyAid'],
  activeExpenseTypes: ['housing', 'food', 'cvec'],
}

describe('computeBudgetTotals', () => {
  it('ne compte que les postes actifs', () => {
    // `other` (999 € / 777 €) est renseigné mais inactif : il ne doit pas compter.
    const { totalIncomes, totalExpenses } = computeBudgetTotals(base)
    expect(totalIncomes).toBe(700)
    expect(totalExpenses).toBe(500 + 150 + 120 / 12)
  })

  it('ramène les montants annuels au mois', () => {
    const { totalExpenses } = computeBudgetTotals({ ...base, activeExpenseTypes: ['cvec'] })
    expect(totalExpenses).toBe(10)
  })

  it('calcule le solde', () => {
    const { remainingBalance } = computeBudgetTotals(base)
    expect(remainingBalance).toBe(700 - 660)
  })
})
