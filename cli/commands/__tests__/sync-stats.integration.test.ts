import { describe, it, expect, vi, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { getTestDb } from '../../../src/__tests__/helpers/test-db'
import { stats, eventStats } from '../../../src/server/db/schema'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const testDb = getTestDb()

// Mock cli/lib/db to use test DB
vi.mock('../../lib/db', () => ({
  db: testDb,
  closeDb: vi.fn(),
}))

// Mock matomo to avoid real API calls
vi.mock('../../lib/matomo', () => ({
  getCompleteStats: vi.fn(),
  getAllEvents: vi.fn(),
}))

const { default: command } = await import('../sync-stats')
const { getCompleteStats, getAllEvents } = await import('../../lib/matomo')

beforeEach(() => {
  vi.mocked(getCompleteStats).mockReset()
  vi.mocked(getAllEvents).mockReset()

  process.env.MATOMO_URL = 'https://matomo.example.com/'
  process.env.MATOMO_TOKEN = 'test-token'
  process.env.MATOMO_ID_SITE = '1'
})

describe('sync-stats integration', () => {
  it('inserts stats and events into the database', async () => {
    const db = getTestDb()

    vi.mocked(getCompleteStats).mockResolvedValue({
      uniqueVisitors: 150,
      newVisitsPercentage: 25,
      averageDuration: 120,
      bounceRatePercentage: 45,
      pageViews: 500,
      visitorsPerPage: 2.5,
      topPages: [{ label: '/accueil', nbVisits: 100 }],
      mainEntryPages: [{ label: '/', nbVisits: 80 }],
      mainSources: [{ label: 'google.com', nbVisits: 60 }],
    })

    vi.mocked(getAllEvents).mockResolvedValue([
      { category: 'click', action: 'search', nbEvents: 10, nbUniqueEvents: 5, eventValue: 0 },
      { category: 'click', action: 'filter', nbEvents: 8, nbUniqueEvents: 3, eventValue: 0 },
    ])

    const result = await command.execute({ date: '2025-03-01' })

    // 1 stats + 2 events
    expect(result.updated).toBe(3)

    // Verify stats row
    const statsRows = await db.select().from(stats).where(eq(stats.date, '2025-03-01'))
    expect(statsRows).toHaveLength(1)
    expect(statsRows[0].uniqueVisitors).toBe(150)
    expect(statsRows[0].pageViews).toBe(500)

    // Verify event rows
    const eventRows = await db.select().from(eventStats).where(eq(eventStats.date, '2025-03-01'))
    expect(eventRows).toHaveLength(2)
    expect(eventRows.map((e) => e.action).sort()).toEqual(['filter', 'search'])
  })

  it('skips when stats exist and no --force', async () => {
    const db = getTestDb()

    // Pre-insert a stats row
    await db.insert(stats).values({
      date: '2025-03-02',
      uniqueVisitors: 10,
      pageViews: 20,
    })

    const result = await command.execute({ date: '2025-03-02' })

    expect(result.skipped).toBe(1)
    expect(getCompleteStats).not.toHaveBeenCalled()
  })

  it('overwrites stats with --force', async () => {
    const db = getTestDb()

    // Pre-insert
    await db.insert(stats).values({
      date: '2025-03-03',
      uniqueVisitors: 10,
      pageViews: 20,
    })

    vi.mocked(getCompleteStats).mockResolvedValue({
      uniqueVisitors: 999,
      newVisitsPercentage: 0,
      averageDuration: 0,
      bounceRatePercentage: 0,
      pageViews: 999,
      visitorsPerPage: 0,
      topPages: [],
      mainEntryPages: [],
      mainSources: [],
    })
    vi.mocked(getAllEvents).mockResolvedValue([])

    await command.execute({ date: '2025-03-03', force: true })

    const rows = await db.select().from(stats).where(eq(stats.date, '2025-03-03'))
    expect(rows).toHaveLength(1)
    expect(rows[0].uniqueVisitors).toBe(999)
  })
})
