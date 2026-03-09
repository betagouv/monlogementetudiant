import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('../../lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

const { default: command } = await import('../sync-rents')
const { db } = await import('../../lib/db')

beforeEach(() => {
  mockFetch.mockReset()
  vi.mocked(db.select).mockReset()
  vi.mocked(db.update).mockReset()
})

describe('sync-rents', () => {
  it('has correct name and description', () => {
    expect(command.name).toBe('rents')
  })

  it('parses CSV with semicolon delimiter and decimal comma', async () => {
    const csvContent = '"EPCI";"loypredm2"\n"200054781";"12,50"\n"200066008";"8,30"\n'
    const buffer = Buffer.from(csvContent, 'latin1')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    })

    const citiesData = [
      { id: 1, epciCode: '200054781' },
      { id: 2, epciCode: '200066008' },
      { id: 3, epciCode: null },
    ]

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockResolvedValue(citiesData),
    } as never)

    vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    } as never)

    const result = await command.execute({ dryRun: true, verbose: true })

    // 2 cities with matching EPCI, 1 skipped (no epciCode)
    expect(result.updated).toBe(2)
    expect(result.skipped).toBe(1)
  })

  it('throws on download error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    await expect(command.execute({})).rejects.toThrow('Erreur téléchargement CSV')
  })
})
