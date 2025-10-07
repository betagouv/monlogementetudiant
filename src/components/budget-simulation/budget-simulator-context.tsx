'use client'

import { type ReactNode, createContext, useContext, useState } from 'react'

interface MonthlyIncomes {
  salary: number
  housingAssistance: number
  other: number
}

interface MonthlyExpenses {
  housing: number // Charge d'habitation
  food: number // Dépenses d'alimentation
  enjoyment: number // Dépenses de loisir
  transport: number // Dépenses de transport
  communication: number // Dépenses de communication
  education: number // Dépenses d'étude
  healthcare: number // Dépenses de soin
  childcare: number // Dépenses de garde d'enfants
  other: number // Autres dépenses
}

interface BudgetSimulatorState {
  monthlyIncomes: MonthlyIncomes
  monthlyExpenses: MonthlyExpenses
  activeIncomeTypes: (keyof MonthlyIncomes)[]
  activeExpenseTypes: (keyof MonthlyExpenses)[]
}

interface BudgetSimulatorContextType {
  state: BudgetSimulatorState
  setState: (state: BudgetSimulatorState) => void
  updateMonthlyIncomes: (incomes: Partial<MonthlyIncomes>) => void
  updateMonthlyExpenses: (expenses: Partial<MonthlyExpenses>) => void
  addIncomeType: (type: keyof MonthlyIncomes) => void
  removeIncomeType: (type: keyof MonthlyIncomes) => void
  addExpenseType: (type: keyof MonthlyExpenses) => void
  removeExpenseType: (type: keyof MonthlyExpenses) => void
}

export type ExpenseType = keyof MonthlyExpenses

const BudgetSimulatorContext = createContext<BudgetSimulatorContextType | undefined>(undefined)

interface BudgetSimulatorProviderProps {
  children: ReactNode
}

export function BudgetSimulatorProvider({ children }: BudgetSimulatorProviderProps) {
  const [state, setState] = useState<BudgetSimulatorState>({
    monthlyIncomes: {
      salary: 0,
      housingAssistance: 0,
      other: 0,
    },
    monthlyExpenses: {
      housing: 0,
      food: 0,
      enjoyment: 0,
      communication: 0,
      transport: 0,
      education: 0,
      healthcare: 0,
      childcare: 0,
      other: 0,
    },
    activeIncomeTypes: ['salary'],
    activeExpenseTypes: ['housing'],
  })

  const updateMonthlyIncomes = (incomes: Partial<MonthlyIncomes>) => {
    setState((prev) => ({ ...prev, monthlyIncomes: { ...prev.monthlyIncomes, ...incomes } }))
  }

  const updateMonthlyExpenses = (expenses: Partial<MonthlyExpenses>) => {
    setState((prev) => ({ ...prev, monthlyExpenses: { ...prev.monthlyExpenses, ...expenses } }))
  }

  const addIncomeType = (type: keyof MonthlyIncomes) => {
    setState((prev) => ({
      ...prev,
      activeIncomeTypes: [...prev.activeIncomeTypes, type],
    }))
  }

  const removeIncomeType = (type: keyof MonthlyIncomes) => {
    setState((prev) => ({
      ...prev,
      activeIncomeTypes: prev.activeIncomeTypes.filter((t) => t !== type),
      monthlyIncomes: { ...prev.monthlyIncomes, [type]: 0 },
    }))
  }

  const addExpenseType = (type: keyof MonthlyExpenses) => {
    setState((prev) => ({
      ...prev,
      activeExpenseTypes: [...prev.activeExpenseTypes, type],
    }))
  }

  const removeExpenseType = (type: keyof MonthlyExpenses) => {
    setState((prev) => ({
      ...prev,
      activeExpenseTypes: prev.activeExpenseTypes.filter((t) => t !== type),
      monthlyExpenses: { ...prev.monthlyExpenses, [type]: 0 },
    }))
  }

  return (
    <BudgetSimulatorContext.Provider
      value={{
        state,
        setState,
        updateMonthlyIncomes,
        updateMonthlyExpenses,
        addIncomeType,
        removeIncomeType,
        addExpenseType,
        removeExpenseType,
      }}
    >
      {children}
    </BudgetSimulatorContext.Provider>
  )
}

export function useBudgetSimulator() {
  const context = useContext(BudgetSimulatorContext)
  if (context === undefined) {
    throw new Error('useBudgetSimulator must be used within a BudgetSimulatorProvider')
  }
  return context
}
