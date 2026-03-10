import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('../../lib/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}))

const { default: command } = await import('../sync-students')
const { db } = await import('../../lib/db')

beforeEach(() => {
  mockFetch.mockReset()
  vi.mocked(db.select).mockReset()
  vi.mocked(db.update).mockReset()
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as never)
})

describe('sync-students', () => {
  it('has correct name', () => {
    expect(command.name).toBe('students')
  })

  it('filters records by academic year and aggregates by INSEE', async () => {
    const records = [
      { annee_universitaire: '2023-24', com_code: '75056', com_nom: 'Paris', dp_code: '75', effectif: 100 },
      { annee_universitaire: '2023-24', com_code: '75056', com_nom: 'Paris', dp_code: '75', effectif: 200 },
      { annee_universitaire: '2022-23', com_code: '75056', com_nom: 'Paris', dp_code: '75', effectif: 50 },
      { annee_universitaire: '2023-24', com_code: '69123', com_nom: 'Lyon', dp_code: '69', effectif: 150 },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => records,
    })

    const allCities = [
      { id: 1, name: 'Paris', inseeCodes: ['75056'], departmentId: 1 },
      { id: 2, name: 'Lyon', inseeCodes: ['69123'], departmentId: 2 },
    ]
    const allDepts = [
      { id: 1, code: '75' },
      { id: 2, code: '69' },
    ]

    vi.mocked(db.select)
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue(allCities) } as never)
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue(allDepts) } as never)

    const result = await command.execute({ dryRun: true, verbose: true })

    // Paris: 100+200=300, Lyon: 150, both matched
    expect(result.updated).toBe(2)
  })

  it('throws on download error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    await expect(command.execute({})).rejects.toThrow('Erreur téléchargement')
  })
})
