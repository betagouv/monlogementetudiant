import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { latestJournalMigration, waitForMigrations } from './wait-for-migrations'

vi.mock('~/server/db', () => ({ db: {} }))

const clock = () => {
  let t = 0
  return {
    now: () => t,
    sleep: vi.fn(async (ms: number) => {
      t += ms
    }),
  }
}

describe('waitForMigrations', () => {
  it('résout immédiatement quand la base est à jour', async () => {
    const { now, sleep } = clock()
    await waitForMigrations({ expected: 100, readApplied: async () => 100, now, sleep })
    expect(sleep).not.toHaveBeenCalled()
  })

  it('attend que les migrations arrivent, y compris table absente', async () => {
    const { now, sleep } = clock()
    const values = [null, 50, 100]
    vi.spyOn(console, 'log').mockImplementation(vi.fn())
    await waitForMigrations({
      expected: 100,
      intervalMs: 10_000,
      readApplied: async () => (values.length > 0 ? (values.shift() as number | null) : 100),
      now,
      sleep,
    })
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(10_000)
  })

  it('échoue après le plafond', async () => {
    const { now, sleep } = clock()
    vi.spyOn(console, 'log').mockImplementation(vi.fn())
    await expect(
      waitForMigrations({ expected: 100, timeoutMs: 30_000, intervalMs: 10_000, readApplied: async () => 50, now, sleep }),
    ).rejects.toThrow('migrations Drizzle absentes')
  })
})

describe('latestJournalMigration', () => {
  it('renvoie le plus grand `when` du journal', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'journal-')), '_journal.json')
    fs.writeFileSync(file, JSON.stringify({ entries: [{ when: 1 }, { when: 3 }, { when: 2 }] }))
    expect(latestJournalMigration(file)).toBe(3)
  })
})
