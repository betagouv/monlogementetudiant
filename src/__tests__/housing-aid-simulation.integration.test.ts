import { desc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { type HelpSimulatorFormData } from '~/components/helps-simulator/help-simulator-schema'
import { housingAidSimulations } from '~/server/db/schema'
import { SIMULATION_SESSION_WINDOW_MS } from '~/server/student/simulation-sessions'
import { createUser } from './fixtures/factories'
import { authenticatedCaller, authenticatedCaller2, caller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

const baseInputs: HelpSimulatorFormData = {
  age: 20,
  status: ['student'],
  monthlyIncome: 800,
  monthlyRent: 500,
  rentUnknown: false,
  city: 'Paris',
  hasGuarantor: 'no',
}

describe('housingAidSimulation.get', () => {
  it('requires authentication', async () => {
    await expect(caller.housingAidSimulation.get()).rejects.toThrow('UNAUTHORIZED')
  })

  it('returns null when no simulation is saved', async () => {
    await createUser({ id: 'test-user-id' })
    const result = await authenticatedCaller.housingAidSimulation.get()
    expect(result).toBeNull()
  })
})

describe('housingAidSimulation.save', () => {
  it('requires authentication', async () => {
    await expect(caller.housingAidSimulation.save(baseInputs)).rejects.toThrow('UNAUTHORIZED')
  })

  it('saves the simulation and returns it via get', async () => {
    await createUser({ id: 'test-user-id' })

    await authenticatedCaller.housingAidSimulation.save(baseInputs)

    const result = await authenticatedCaller.housingAidSimulation.get()
    expect(result).toMatchObject({ age: 20, city: 'Paris', monthlyRent: 500, hasGuarantor: 'no' })
  })

  it('deux saves dans la fenêtre de session mettent à jour la même version', async () => {
    await createUser({ id: 'test-user-id' })

    await authenticatedCaller.housingAidSimulation.save(baseInputs)
    await authenticatedCaller.housingAidSimulation.save({ ...baseInputs, city: 'Lyon', monthlyRent: 420 })

    const result = await authenticatedCaller.housingAidSimulation.get()
    expect(result?.city).toBe('Lyon')
    expect(result?.monthlyRent).toBe(420)

    const versions = await getTestDb().select().from(housingAidSimulations).where(eq(housingAidSimulations.userId, 'test-user-id'))
    expect(versions).toHaveLength(1)
  })

  it('un save après la fenêtre de session ouvre une nouvelle version, get renvoie la plus récente', async () => {
    await createUser({ id: 'test-user-id' })
    const db = getTestDb()

    await authenticatedCaller.housingAidSimulation.save(baseInputs)
    const stale = new Date(Date.now() - SIMULATION_SESSION_WINDOW_MS - 60_000)
    await db
      .update(housingAidSimulations)
      .set({ createdAt: stale, updatedAt: stale })
      .where(eq(housingAidSimulations.userId, 'test-user-id'))

    await authenticatedCaller.housingAidSimulation.save({ ...baseInputs, city: 'Lyon' })

    const versions = await db
      .select()
      .from(housingAidSimulations)
      .where(eq(housingAidSimulations.userId, 'test-user-id'))
      .orderBy(desc(housingAidSimulations.updatedAt))
    expect(versions).toHaveLength(2)
    expect(versions[0].inputs.city).toBe('Lyon')
    expect(versions[1].inputs.city).toBe('Paris')

    const result = await authenticatedCaller.housingAidSimulation.get()
    expect(result?.city).toBe('Lyon')
  })

  it('normalizes a NaN rent (loyer non renseigné) to undefined', async () => {
    await createUser({ id: 'test-user-id' })

    await authenticatedCaller.housingAidSimulation.save({ ...baseInputs, monthlyRent: Number.NaN, rentUnknown: true })

    const result = await authenticatedCaller.housingAidSimulation.get()
    expect(result?.monthlyRent).toBeUndefined()
    expect(result?.rentUnknown).toBe(true)
  })

  it('isolates simulations per user', async () => {
    await createUser({ id: 'test-user-id' })
    await createUser({ id: 'test-user-id-2' })

    await authenticatedCaller.housingAidSimulation.save({ ...baseInputs, city: 'Paris' })
    await authenticatedCaller2.housingAidSimulation.save({ ...baseInputs, city: 'Bordeaux' })

    const first = await authenticatedCaller.housingAidSimulation.get()
    const second = await authenticatedCaller2.housingAidSimulation.get()
    expect(first?.city).toBe('Paris')
    expect(second?.city).toBe('Bordeaux')
  })
})
