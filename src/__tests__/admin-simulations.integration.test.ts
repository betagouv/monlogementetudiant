import { describe, expect, it } from 'vitest'
import type { HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import type { TBudgetSimulation } from '~/schemas/budget-simulation'
import { createUser } from './fixtures/factories'
import './helpers/setup-integration'
import { adminCaller, authenticatedCaller, authenticatedCaller2, caller } from './helpers/test-caller'

const budgetInputs = (housing: number, salary: number): TBudgetSimulation => ({
  monthlyIncomes: {
    familyAid: 0,
    scholarships: 0,
    cafHousingAid: 0,
    otherPublicAid: 0,
    salary,
    studentLoan: 0,
    other: 0,
    savings: 0,
  },
  monthlyExpenses: {
    housing,
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
  activeIncomeTypes: ['salary'],
  activeExpenseTypes: ['housing'],
})

const aidInputs = (overrides: Partial<HelpSimulatorFormData> = {}): HelpSimulatorFormData => ({
  age: 20,
  status: ['student'],
  monthlyIncome: 800,
  monthlyRent: 500,
  rentUnknown: false,
  city: 'Paris',
  hasGuarantor: 'no',
  ...overrides,
})

describe('admin.simulations.overview', () => {
  it('refuse un utilisateur non admin', async () => {
    await expect(caller.admin.simulations.overview()).rejects.toThrow('UNAUTHORIZED')
  })

  it('agrège toutes les versions du budget et des aides', async () => {
    await createUser({ id: 'test-user-id' })
    await createUser({ id: 'test-user-id-2' })
    await createUser({ id: 'test-admin-id', role: 'admin' })

    // Budget : 2 versions pour le 1er étudiant (via reset), 1 pour le 2e → 3 versions.
    await authenticatedCaller.budgetSimulation.save(budgetInputs(500, 1000))
    await authenticatedCaller.budgetSimulation.reset(budgetInputs(0, 0))
    await authenticatedCaller.budgetSimulation.save(budgetInputs(700, 1200))
    await authenticatedCaller2.budgetSimulation.save(budgetInputs(300, 800))

    // Aides : 2 versions étudiant (dont un boursier multi-statuts), 1 apprenti sans loyer.
    await authenticatedCaller.housingAidSimulation.save(aidInputs({ monthlyIncome: 600, monthlyRent: 400, hasGuarantor: 'yes' }))
    await authenticatedCaller.housingAidSimulation.save(
      aidInputs({ status: ['student', 'boursier-crous'], monthlyIncome: 400, monthlyRent: 500 }),
    )
    await authenticatedCaller2.housingAidSimulation.save(
      aidInputs({ status: ['apprentice'], monthlyIncome: 1100, monthlyRent: Number.NaN }),
    )

    const overview = await adminCaller.admin.simulations.overview()

    expect(overview.budget.count).toBe(3)
    expect(overview.budget.averageIncomes).toBe(Math.round((1200 + 800 + 1000) / 3))
    expect(overview.budget.averageExpenses).toBe(Math.round((700 + 300 + 500) / 3))
    expect(overview.budget.averageBalance).toBe(Math.round((500 + 500 + 500) / 3))

    expect(overview.housingAid.count).toBe(3)
    const student = overview.housingAid.byStatus.find((row) => row.status === 'student')
    expect(student).toMatchObject({ count: 2, averageIncome: 500, averageRent: 450, guarantorRate: 50 })
    const boursier = overview.housingAid.byStatus.find((row) => row.status === 'boursier-crous')
    expect(boursier).toMatchObject({ count: 1, averageIncome: 400 })
    const apprentice = overview.housingAid.byStatus.find((row) => row.status === 'apprentice')
    // Loyer non renseigné (NaN normalisé) : pas de moyenne de loyer pour cette ligne.
    expect(apprentice).toMatchObject({ count: 1, averageIncome: 1100, averageRent: null, guarantorRate: 0 })
    expect(overview.housingAid.byStatus.find((row) => row.status === 'lyceen')).toBeUndefined()
  })
})
