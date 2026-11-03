import type { TBudgetFrequency } from '~/schemas/budget-simulation'

export function getMonthlyEquivalent(amount: number, frequency: TBudgetFrequency) {
  return frequency === 'yearly' ? amount / 12 : amount
}

export function formatBudgetAmount(amount: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}
