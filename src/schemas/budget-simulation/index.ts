import { z } from 'zod'

export const ZBudgetFrequency = z.enum(['monthly', 'yearly'])
export type TBudgetFrequency = z.infer<typeof ZBudgetFrequency>

export const INCOME_TYPES = [
  'familyAid',
  'scholarships',
  'cafHousingAid',
  'otherPublicAid',
  'salary',
  'studentLoan',
  'other',
  'savings',
] as const

export const EXPENSE_TYPES = [
  'housing',
  'housingCharges',
  'food',
  'dailyLife',
  'communication',
  'transport',
  'registrationFees',
  'cvec',
  'studyMaterials',
  'mutuelle',
  'otherHealthcare',
  'enjoyment',
  'childcare',
  'other',
  'securityDeposit',
  'agencyFees',
  'apartmentEquipment',
] as const

export const ZIncomeType = z.enum(INCOME_TYPES)
export type TIncomeType = z.infer<typeof ZIncomeType>

export const ZExpenseType = z.enum(EXPENSE_TYPES)
export type TExpenseType = z.infer<typeof ZExpenseType>

const zAmount = z.number().min(0)

const buildAmountsShape = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, zAmount])) as Record<K, typeof zAmount>

const buildFrequenciesShape = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, ZBudgetFrequency])) as Record<K, typeof ZBudgetFrequency>

export const ZMonthlyIncomes = z.object(buildAmountsShape(INCOME_TYPES))
export type TMonthlyIncomes = z.infer<typeof ZMonthlyIncomes>

export const ZMonthlyExpenses = z.object(buildAmountsShape(EXPENSE_TYPES))
export type TMonthlyExpenses = z.infer<typeof ZMonthlyExpenses>

export const ZBudgetSimulation = z.object({
  monthlyIncomes: ZMonthlyIncomes,
  monthlyExpenses: ZMonthlyExpenses,
  incomeFrequencies: z.object(buildFrequenciesShape(INCOME_TYPES)),
  expenseFrequencies: z.object(buildFrequenciesShape(EXPENSE_TYPES)),
  activeIncomeTypes: z.array(ZIncomeType),
  activeExpenseTypes: z.array(ZExpenseType),
})

export type TBudgetSimulation = z.infer<typeof ZBudgetSimulation>
