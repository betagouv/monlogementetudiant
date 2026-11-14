import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ calls: [] as string[], drizzleMigrate: vi.fn(), graphileMigrate: vi.fn(), closeDb: vi.fn() }))

vi.mock('drizzle-orm/postgres-js/migrator', () => ({ migrate: mocks.drizzleMigrate }))
vi.mock('graphile-worker', () => ({ runMigrations: mocks.graphileMigrate }))
vi.mock('~/server/db', () => ({ db: {}, closeDb: mocks.closeDb }))

import { env } from '~/server/env'
import { migrate } from '../migrate'

beforeEach(() => {
  mocks.calls.length = 0
  mocks.drizzleMigrate.mockReset().mockImplementation(async () => mocks.calls.push('drizzle'))
  mocks.graphileMigrate.mockReset().mockImplementation(async () => mocks.calls.push('graphile'))
  mocks.closeDb.mockReset().mockImplementation(async () => mocks.calls.push('close'))
  vi.spyOn(console, 'log').mockImplementation(vi.fn())
})

describe('migrate', () => {
  it('installe le schéma graphile_worker après les migrations Drizzle', async () => {
    await migrate()

    expect(mocks.calls).toEqual(['drizzle', 'graphile', 'close'])
    expect(mocks.graphileMigrate).toHaveBeenCalledWith({ connectionString: env.DATABASE_URL })
  })

  it('ne lance pas graphile si Drizzle échoue, et ferme la connexion', async () => {
    mocks.drizzleMigrate.mockRejectedValueOnce(new Error('ko'))

    await expect(migrate()).rejects.toThrow('ko')
    expect(mocks.graphileMigrate).not.toHaveBeenCalled()
    expect(mocks.closeDb).toHaveBeenCalled()
  })
})
