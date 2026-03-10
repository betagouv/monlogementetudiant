import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCityByInsee, fetchCityFromGeoApi, geocodeAddress } from '../geocoder'

vi.mock('../db', () => ({
  db: {
    select: vi
      .fn()
      .mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('geocodeAddress', () => {
  it('returns coordinates from geocoding API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        features: [
          {
            geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
            properties: { city: 'Paris', name: '1 Rue de Rivoli', postcode: '75001' },
          },
        ],
      }),
    })

    const result = await geocodeAddress('1 Rue de Rivoli, 75001 Paris')
    expect(result).toEqual({
      lat: 48.8566,
      lng: 2.3522,
      city: 'Paris',
      address: '1 Rue de Rivoli',
      postalCode: '75001',
    })
  })

  it('returns null when no features found', async () => {
    vi.useFakeTimers()
    const emptyResponse = { ok: true, status: 200, json: async () => ({ features: [] }) }
    mockFetch.mockResolvedValueOnce(emptyResponse).mockResolvedValueOnce(emptyResponse)

    const promise = geocodeAddress('adresse inexistante')
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result).toBeNull()
    vi.useRealTimers()
  })

  it('returns null on API error', async () => {
    vi.useFakeTimers()
    const errorResponse = { ok: false, status: 500 }
    mockFetch.mockResolvedValueOnce(errorResponse).mockResolvedValueOnce(errorResponse)

    const promise = geocodeAddress('test')
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result).toBeNull()
    vi.useRealTimers()
  })

  it('returns null on network error', async () => {
    vi.useFakeTimers()
    mockFetch.mockRejectedValueOnce(new Error('Network error')).mockRejectedValueOnce(new Error('Network error'))

    const promise = geocodeAddress('test')
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result).toBeNull()
    vi.useRealTimers()
  })
})

describe('fetchCityFromGeoApi', () => {
  it('returns the first city for a postal code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ nom: 'Paris', code: '75056', codesPostaux: ['75001'], codeDepartement: '75', codeEpci: '200054781' }],
    })

    const result = await fetchCityFromGeoApi('75001')
    expect(result).toEqual({
      nom: 'Paris',
      code: '75056',
      codesPostaux: ['75001'],
      codeDepartement: '75',
      codeEpci: '200054781',
    })
  })

  it('matches by name when multiple results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { nom: 'Saint-Denis', code: '93066', codesPostaux: ['93200'], codeDepartement: '93' },
        { nom: 'Saint-Denis-de-Pile', code: '33397', codesPostaux: ['93200'], codeDepartement: '33' },
      ],
    })

    const result = await fetchCityFromGeoApi('93200', 'Saint-Denis')
    expect(result?.nom).toBe('Saint-Denis')
  })

  it('matches with diacritics normalization', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { nom: 'Béziers', code: '34032', codesPostaux: ['34500'], codeDepartement: '34' },
        { nom: 'Autre', code: '34000', codesPostaux: ['34500'], codeDepartement: '34' },
      ],
    })

    const result = await fetchCityFromGeoApi('34500', 'Beziers')
    expect(result?.nom).toBe('Béziers')
  })

  it('returns null on empty results', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] })

    const result = await fetchCityFromGeoApi('00000')
    expect(result).toBeNull()
  })
})

describe('fetchCityByInsee', () => {
  it('returns city data by INSEE code', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ nom: 'Lyon', code: '69123', codesPostaux: ['69001'], codeDepartement: '69' }),
    })

    const result = await fetchCityByInsee('69123')
    expect(result?.nom).toBe('Lyon')
  })

  it('returns null on not found', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })

    const result = await fetchCityByInsee('99999')
    expect(result).toBeNull()
  })
})
