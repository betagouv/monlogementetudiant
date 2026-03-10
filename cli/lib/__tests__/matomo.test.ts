import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

process.env.MATOMO_URL = 'https://matomo.example.com/'
process.env.MATOMO_TOKEN = 'test-token'
process.env.MATOMO_ID_SITE = '1'

const { getCompleteStats, getAllEvents } = await import('../matomo')

beforeEach(() => {
  mockFetch.mockReset()
  process.env.MATOMO_URL = 'https://matomo.example.com/'
  process.env.MATOMO_TOKEN = 'test-token'
  process.env.MATOMO_ID_SITE = '1'
})

afterEach(() => {
  delete process.env.MATOMO_URL
  delete process.env.MATOMO_TOKEN
  delete process.env.MATOMO_ID_SITE
})

describe('getCompleteStats', () => {
  it('calls Matomo API with period=day and returns parsed stats', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    // Mock responses in order: visitSummary, actions, entryPages, referrers
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nb_uniq_visitors: 150,
          nb_visits: 200,
          nb_visits_new: 50,
          avg_time_on_site: 120,
          bounce_rate: '45%',
          nb_actions: 500,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ label: '/accueil', nb_visits: 100 }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ label: '/login', nb_visits: 80 }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ label: 'google.com', nb_visits: 60 }],
      })

    const result = await getCompleteStats('2025-03-01')

    expect(result.uniqueVisitors).toBe(150)
    expect(result.newVisitsPercentage).toBe(25)
    expect(result.averageDuration).toBe(120)
    expect(result.bounceRatePercentage).toBe(45)
    expect(result.pageViews).toBe(500)
    expect(result.visitorsPerPage).toBe(2.5)
    expect(result.topPages).toEqual([{ label: '/accueil', nbVisits: 100 }])
    expect(result.mainEntryPages).toEqual([{ label: '/login', nbVisits: 80 }])
    expect(result.mainSources).toEqual([{ label: 'google.com', nbVisits: 60 }])

    const firstCall = mockFetch.mock.calls[0][0]
    const url = new URL(firstCall)
    expect(url.searchParams.get('period')).toBe('day')
    expect(url.searchParams.get('date')).toBe('2025-03-01')
    expect(url.searchParams.get('token_auth')).toBe('test-token')
  })

  it('handles missing values with defaults', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => null })
      .mockResolvedValueOnce({ ok: true, json: async () => null })
      .mockResolvedValueOnce({ ok: true, json: async () => null })

    const result = await getCompleteStats('2025-03-01')

    expect(result.uniqueVisitors).toBe(0)
    expect(result.pageViews).toBe(0)
    expect(result.topPages).toEqual([])
  })
})

describe('getAllEvents', () => {
  it('fetches categories and actions', async () => {
    // First call: getCategory
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ label: 'click', nb_events: 10, nb_events_with_value: 5, sum_event_value: 100, subtable: [{}] }],
    })
    // Second call: getActionFromCategoryId
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ label: 'button_search', nb_events: 8, nb_events_with_value: 3, sum_event_value: 50 }],
    })

    const events = await getAllEvents('2025-03-01')

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      category: 'click',
      action: 'button_search',
      nbEvents: 8,
      nbUniqueEvents: 3,
      eventValue: 50,
    })
  })

  it('falls back to category data when no actions array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ label: 'download', nb_events: 5, nb_events_with_value: 2, sum_event_value: 10 }],
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}), // Not an array
    })

    const events = await getAllEvents('2025-03-01')

    expect(events).toHaveLength(1)
    expect(events[0].category).toBe('download')
    expect(events[0].action).toBe('')
    expect(events[0].nbEvents).toBe(5)
  })

  it('returns empty array when no categories', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    })

    const events = await getAllEvents('2025-03-01')
    expect(events).toEqual([])
  })
})
