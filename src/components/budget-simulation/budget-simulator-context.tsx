'use client'

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { trackEvent } from '~/lib/tracking'

interface MonthlyIncomes {
  familyAid: number // Aides de ma famille
  scholarships: number // Bourses (du Crous ou de la Région)
  cafHousingAid: number // Aides au logement de la CAF
  otherPublicAid: number // Autres aides publiques
  salary: number // Job étudiant
  studentLoan: number // Prêt étudiant (ex : prêt étudiant garanti par l'Etat)
  other: number // Autres revenus
  savings: number // Argent mis de côté
}

interface MonthlyExpenses {
  housing: number // Loyer
  housingCharges: number // Charges d'habitation (Assurance, charges, eau, électricité…)
  food: number // Alimentation (restauration collective et courses d'alimentation)
  dailyLife: number // Vie quotidienne (habillement, produit d'hygiène…)
  communication: number // Téléphone et internet
  transport: number // Transports (quotidiens et pour rentrer chez moi)
  registrationFees: number // Frais d'inscription dans mon établissement d'enseignement
  cvec: number // CVEC
  studyMaterials: number // Matériel pour les études (ordinateur, impressions, livres, papier, petit matériel)
  mutuelle: number // Mutuelle
  otherHealthcare: number // Autres frais de santé
  enjoyment: number // Loisirs (activités sportives, culturelles, sorties entre amis)
  childcare: number // Garde d'enfant
  other: number // Autre
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

export const EXPENSE_RANGES = {
  housingCharges: { lowRange: 85, highRange: 100 },
  dailyLife: { lowRange: 60, highRange: 75 },
  food: { lowRange: 130, highRange: 145 },
  enjoyment: { lowRange: 60, highRange: 65 },
  communication: { lowRange: 30, highRange: 35 },
  studyMaterials: { lowRange: 25, highRange: 30 },
  mutuelle: { lowRange: 35, highRange: 45 },
  otherHealthcare: { lowRange: 35, highRange: 40 },
  childcare: { lowRange: 30, highRange: 35 },
  other: { lowRange: 40, highRange: 50 },
} as const

const BudgetSimulatorContext = createContext<BudgetSimulatorContextType | undefined>(undefined)

interface BudgetSimulatorProviderProps {
  children: ReactNode
}

export function BudgetSimulatorProvider({ children }: BudgetSimulatorProviderProps) {
  useEffect(() => {
    trackEvent({ category: 'Simulateur', action: 'demarrage simulateur budget' })
  }, [])

  const [state, setState] = useState<BudgetSimulatorState>({
    monthlyIncomes: {
      familyAid: 0,
      scholarships: 0,
      cafHousingAid: 0,
      otherPublicAid: 0,
      salary: 0,
      studentLoan: 0,
      other: 0,
      savings: 0,
    },
    monthlyExpenses: {
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
