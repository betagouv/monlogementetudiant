import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../../lib/matomo', () => ({
  getCompleteStats: vi.fn(),
  getAllEvents: vi.fn(),
}))

const { default: command } = await import('../sync-stats')
const { db } = await import('../../lib/db')
const { getCompleteStats, getAllEvents } = await import('../../lib/matomo')

beforeEach(() => {
  vi.mocked(db.select).mockReset()
  vi.mocked(db.insert).mockReset()
  vi.mocked(db.update).mockReset()
  vi.mocked(db.delete).mockReset()
  vi.mocked(getCompleteStats).mockReset()
  vi.mocked(getAllEvents).mockReset()

  process.env.MATOMO_URL = 'https://matomo.example.com/'
  process.env.MATOMO_TOKEN = 'test-token'
  process.env.MATOMO_ID_SITE = '1'
})

describe('sync-stats', () => {
  it('has correct name', () => {
    expect(command.name).toBe('stats')
  })

  it('defaults to yesterday when no date provided', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const expectedDate = yesterday.toISOString().split('T')[0]

    // Mock existing check: no existing stats
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never)

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never)

    vi.mocked(getCompleteStats).mockResolvedValue({
      uniqueVisitors: 100,
      newVisitsPercentage: 20,
      averageDuration: 60,
      bounceRatePercentage: 40,
      pageViews: 200,
      visitorsPerPage: 2,
      topPages: [],
      mainEntryPages: [],
      mainSources: [],
    })

    vi.mocked(getAllEvents).mockResolvedValue([])

    await command.execute({})

    expect(getCompleteStats).toHaveBeenCalledWith(expectedDate)
    expect(getAllEvents).toHaveBeenCalledWith(expectedDate)
  })

  it('uses provided date', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never)

    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as never)

    vi.mocked(getCompleteStats).mockResolvedValue({
      uniqueVisitors: 0, newVisitsPercentage: 0, averageDuration: 0,
      bounceRatePercentage: 0, pageViews: 0, visitorsPerPage: 0,
      topPages: [], mainEntryPages: [], mainSources: [],
    })
    vi.mocked(getAllEvents).mockResolvedValue([])

    await command.execute({ date: '2025-01-15' })

    expect(getCompleteStats).toHaveBeenCalledWith('2025-01-15')
  })

  it('skips when stats exist and no --force', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 1 }]),
        }),
      }),
    } as never)

    const result = await command.execute({ date: '2025-01-15' })

    expect(result.skipped).toBe(1)
    expect(getCompleteStats).not.toHaveBeenCalled()
  })

  it('dry-run does not write to DB', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never)

    const result = await command.execute({ date: '2025-01-15', dryRun: true })

    expect(result.updated).toBe(1)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('throws when env vars are missing', async () => {
    delete process.env.MATOMO_URL

    await expect(command.execute({})).rejects.toThrow('Missing env vars')
  })
})
