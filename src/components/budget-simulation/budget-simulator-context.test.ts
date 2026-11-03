import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BUDGET_SIMULATOR_STATE,
  replaceExpenseTypeInState,
  replaceIncomeTypeInState,
} from '~/components/budget-simulation/budget-simulator-context'

describe('replaceExpenseTypeInState', () => {
  it('remplace la dépense à la même position', () => {
    const next = replaceExpenseTypeInState(DEFAULT_BUDGET_SIMULATOR_STATE, 'housing', 'mutuelle')
    expect(next.activeExpenseTypes).toEqual(['mutuelle', 'food', 'transport'])
  })

  it('reporte le montant sur la nouvelle dépense et remet l’ancienne à zéro', () => {
    const state = { ...DEFAULT_BUDGET_SIMULATOR_STATE, monthlyExpenses: { ...DEFAULT_BUDGET_SIMULATOR_STATE.monthlyExpenses, food: 150 } }
    const next = replaceExpenseTypeInState(state, 'food', 'enjoyment')
    expect(next.monthlyExpenses.enjoyment).toBe(150)
    expect(next.monthlyExpenses.food).toBe(0)
  })

  it('applique la fréquence par défaut de la nouvelle dépense', () => {
    const state = {
      ...DEFAULT_BUDGET_SIMULATOR_STATE,
      expenseFrequencies: { ...DEFAULT_BUDGET_SIMULATOR_STATE.expenseFrequencies, transport: 'yearly' as const },
    }
    const next = replaceExpenseTypeInState(state, 'transport', 'cvec')
    expect(next.expenseFrequencies.cvec).toBe('yearly')
    expect(next.expenseFrequencies.transport).toBe('monthly')
  })

  it('ne change rien si la dépense est identique', () => {
    expect(replaceExpenseTypeInState(DEFAULT_BUDGET_SIMULATOR_STATE, 'food', 'food')).toBe(DEFAULT_BUDGET_SIMULATOR_STATE)
  })
})

describe('replaceIncomeTypeInState', () => {
  it('remplace le revenu à la même position', () => {
    const next = replaceIncomeTypeInState(DEFAULT_BUDGET_SIMULATOR_STATE, 'salary', 'savings')
    expect(next.activeIncomeTypes).toEqual(['savings', 'scholarships', 'familyAid'])
  })

  it('reporte le montant sur le nouveau revenu et remet l’ancien à zéro', () => {
    const state = {
      ...DEFAULT_BUDGET_SIMULATOR_STATE,
      monthlyIncomes: { ...DEFAULT_BUDGET_SIMULATOR_STATE.monthlyIncomes, scholarships: 300 },
    }
    const next = replaceIncomeTypeInState(state, 'scholarships', 'studentLoan')
    expect(next.monthlyIncomes.studentLoan).toBe(300)
    expect(next.monthlyIncomes.scholarships).toBe(0)
  })

  it('ne change rien si le revenu est identique', () => {
    expect(replaceIncomeTypeInState(DEFAULT_BUDGET_SIMULATOR_STATE, 'salary', 'salary')).toBe(DEFAULT_BUDGET_SIMULATOR_STATE)
  })
})
