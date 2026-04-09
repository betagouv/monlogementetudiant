import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const mockStats = {
  uniqueVisitors: 100,
  newVisitsPercentage: 20,
  averageDuration: 60,
  bounceRatePercentage: 40,
  pageViews: 200,
  visitorsPerPage: 2,
  topPages: [],
  mainEntryPages: [],
  mainSources: [],
}

function mockDbNoExisting() {
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

  vi.mocked(db.delete).mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  } as never)
}

function mockDbExisting(id = 1) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ id }]),
      }),
    }),
  } as never)
}

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

    mockDbNoExisting()
    vi.mocked(getCompleteStats).mockResolvedValue(mockStats)
    vi.mocked(getAllEvents).mockResolvedValue([])

    await command.execute({})

    expect(getCompleteStats).toHaveBeenCalledWith(expectedDate)
    expect(getAllEvents).toHaveBeenCalledWith(expectedDate)
  })

  it('uses provided date', async () => {
    mockDbNoExisting()
    vi.mocked(getCompleteStats).mockResolvedValue(mockStats)
    vi.mocked(getAllEvents).mockResolvedValue([])

    await command.execute({ date: '2025-01-15' })

    expect(getCompleteStats).toHaveBeenCalledWith('2025-01-15')
    expect(getAllEvents).toHaveBeenCalledWith('2025-01-15')
  })

  it('skips when stats exist and no --force', async () => {
    mockDbExisting()

    const result = await command.execute({ date: '2025-01-15' })

    expect(result.skipped).toBe(1)
    expect(getCompleteStats).not.toHaveBeenCalled()
    expect(getAllEvents).not.toHaveBeenCalled()
  })

  it('dry-run does not write to DB', async () => {
    mockDbNoExisting()

    const result = await command.execute({ date: '2025-01-15', dryRun: true })

    expect(result.updated).toBe(1)
    expect(db.insert).not.toHaveBeenCalled()
    expect(getCompleteStats).not.toHaveBeenCalled()
  })

  it('throws when env vars are missing', async () => {
    delete process.env.MATOMO_URL

    await expect(command.execute({})).rejects.toThrow('Missing env vars')
  })

  it('syncs only events with --only events', async () => {
    mockDbNoExisting()
    vi.mocked(getAllEvents).mockResolvedValue([{ category: 'click', action: 'search', nbEvents: 10, nbUniqueEvents: 5, eventValue: 0 }])

    await command.execute({ date: '2025-01-15', only: 'events' })

    expect(getCompleteStats).not.toHaveBeenCalled()
    expect(getAllEvents).toHaveBeenCalledWith('2025-01-15')
  })

  it('syncs only stats with --only stats', async () => {
    mockDbNoExisting()
    vi.mocked(getCompleteStats).mockResolvedValue(mockStats)

    await command.execute({ date: '2025-01-15', only: 'stats' })

    expect(getCompleteStats).toHaveBeenCalledWith('2025-01-15')
    expect(getAllEvents).not.toHaveBeenCalled()
  })

  it('syncs date range with --from and --to', { timeout: 15000 }, async () => {
    mockDbNoExisting()
    vi.mocked(getCompleteStats).mockResolvedValue(mockStats)
    vi.mocked(getAllEvents).mockResolvedValue([])

    const result = await command.execute({ from: '2025-01-01', to: '2025-01-03' })

    expect(result.updated).toBe(3)
    expect(getCompleteStats).toHaveBeenCalledTimes(3)
    expect(getCompleteStats).toHaveBeenCalledWith('2025-01-01')
    expect(getCompleteStats).toHaveBeenCalledWith('2025-01-02')
    expect(getCompleteStats).toHaveBeenCalledWith('2025-01-03')
  })
})
