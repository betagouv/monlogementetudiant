import { type TBudgetSimulation, ZBudgetSimulation } from '~/schemas/budget-simulation'

export const PENDING_BUDGET_SIMULATION_KEY = 'mle-pending-budget-simulation'

export function storePendingBudgetSimulation(inputs: TBudgetSimulation): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PENDING_BUDGET_SIMULATION_KEY, JSON.stringify(inputs))
  } catch {
    return
  }
}

export function readPendingBudgetSimulation(): TBudgetSimulation | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PENDING_BUDGET_SIMULATION_KEY)
    if (!raw) return null
    const parsed = ZBudgetSimulation.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function clearPendingBudgetSimulation(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(PENDING_BUDGET_SIMULATION_KEY)
  } catch {
    return
  }
}
