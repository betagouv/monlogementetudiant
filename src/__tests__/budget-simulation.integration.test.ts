import { describe, expect, it } from 'vitest'
import type { TBudgetSimulation } from '~/schemas/budget-simulation'
import { createUser } from './fixtures/factories'
import { authenticatedCaller, authenticatedCaller2, caller } from './helpers/test-caller'
import './helpers/setup-integration'

const baseInputs: TBudgetSimulation = {
  monthlyIncomes: {
    familyAid: 200,
    scholarships: 0,
    cafHousingAid: 310,
    otherPublicAid: 0,
    salary: 451,
    studentLoan: 0,
    other: 0,
    savings: 0,
  },
  monthlyExpenses: {
    housing: 520,
    housingCharges: 0,
    food: 150,
    dailyLife: 0,
    communication: 0,
    transport: 40,
    registrationFees: 0,
    cvec: 105,
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
  activeIncomeTypes: ['salary', 'familyAid', 'cafHousingAid'],
  activeExpenseTypes: ['housing', 'food', 'transport', 'cvec'],
}

describe('budgetSimulation.get', () => {
  it('requires authentication', async () => {
    await expect(caller.budgetSimulation.get()).rejects.toThrow('UNAUTHORIZED')
  })

  it('returns null when no simulation is saved', async () => {
    await createUser({ id: 'test-user-id' })
    const result = await authenticatedCaller.budgetSimulation.get()
    expect(result).toBeNull()
  })
})

describe('budgetSimulation.save', () => {
  it('requires authentication', async () => {
    await expect(caller.budgetSimulation.save(baseInputs)).rejects.toThrow('UNAUTHORIZED')
  })

  it('saves the simulation and returns it via get', async () => {
    await createUser({ id: 'test-user-id' })

    await authenticatedCaller.budgetSimulation.save(baseInputs)

    const result = await authenticatedCaller.budgetSimulation.get()
    expect(result).toEqual(baseInputs)
  })

  it('upserts (a second save overwrites the first, no duplicate)', async () => {
    await createUser({ id: 'test-user-id' })

    await authenticatedCaller.budgetSimulation.save(baseInputs)
    await authenticatedCaller.budgetSimulation.save({
      ...baseInputs,
      monthlyExpenses: { ...baseInputs.monthlyExpenses, housing: 610 },
    })

    const result = await authenticatedCaller.budgetSimulation.get()
    expect(result?.monthlyExpenses.housing).toBe(610)
  })

  it('rejects a negative amount', async () => {
    await createUser({ id: 'test-user-id' })

    await expect(
      authenticatedCaller.budgetSimulation.save({
        ...baseInputs,
        monthlyIncomes: { ...baseInputs.monthlyIncomes, salary: -10 },
      }),
    ).rejects.toThrow()
  })

  it('isolates simulations per user', async () => {
    await createUser({ id: 'test-user-id' })
    await createUser({ id: 'test-user-id-2' })

    await authenticatedCaller.budgetSimulation.save(baseInputs)
    await authenticatedCaller2.budgetSimulation.save({
      ...baseInputs,
      monthlyIncomes: { ...baseInputs.monthlyIncomes, salary: 900 },
    })

    const first = await authenticatedCaller.budgetSimulation.get()
    const second = await authenticatedCaller2.budgetSimulation.get()
    expect(first?.monthlyIncomes.salary).toBe(451)
    expect(second?.monthlyIncomes.salary).toBe(900)
  })
})
