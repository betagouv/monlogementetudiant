import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/server/db', () => ({
  db: {
    select: vi.fn(),
  },
  closeDb: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('~/server/services/brevo', () => ({
  syncBrevoOwnerCreated: vi.fn().mockResolvedValue(undefined),
  syncBrevoStudentCreated: vi.fn().mockResolvedValue(undefined),
}))

const { backfillBrevoContacts } = await import('../backfill-brevo-contacts')
const { db, closeDb } = await import('~/server/db')
const { syncBrevoOwnerCreated, syncBrevoStudentCreated } = await import('~/server/services/brevo')

type Row = {
  email: string
  firstname: string
  lastname: string
  role: string
  createdAt: Date
}

// Reproduit la chaîne Drizzle `db.select().from().where()` (+ `.limit()` optionnel),
// où le résultat est thenable (awaitable) comme un query builder Drizzle.
function mockSelect(rows: Row[]) {
  const query = {
    limit: vi.fn((n: number) => Promise.resolve(rows.slice(0, n))),
    then: (resolve: (value: Row[]) => unknown) => resolve(rows),
  }
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(query),
    }),
  } as never)
  return query
}

beforeEach(() => {
  vi.mocked(db.select).mockReset()
  vi.mocked(closeDb).mockClear()
  vi.mocked(syncBrevoOwnerCreated).mockClear().mockResolvedValue(undefined)
  vi.mocked(syncBrevoStudentCreated).mockClear().mockResolvedValue(undefined)
})

describe('backfill-brevo-contacts', () => {
  it('syncs owners with their createdAt and students without a date', async () => {
    mockSelect([
      { email: 'owner@test.com', firstname: 'Jean', lastname: 'Dupont', role: 'owner', createdAt: new Date('2021-03-15T10:00:00.000Z') },
      { email: 'student@test.com', firstname: 'Marie', lastname: 'Martin', role: 'user', createdAt: new Date('2024-01-02T00:00:00.000Z') },
    ])

    await backfillBrevoContacts({})

    expect(syncBrevoOwnerCreated).toHaveBeenCalledOnce()
    expect(syncBrevoOwnerCreated).toHaveBeenCalledWith('owner@test.com', {
      firstname: 'Jean',
      lastname: 'Dupont',
      createdAt: new Date('2021-03-15T10:00:00.000Z'),
    })

    expect(syncBrevoStudentCreated).toHaveBeenCalledOnce()
    expect(syncBrevoStudentCreated).toHaveBeenCalledWith('student@test.com', {
      firstname: 'Marie',
      lastname: 'Martin',
    })

    expect(closeDb).toHaveBeenCalledOnce()
  })

  it('does not call Brevo in dry-run mode', async () => {
    mockSelect([
      { email: 'owner@test.com', firstname: 'Jean', lastname: 'Dupont', role: 'owner', createdAt: new Date('2021-03-15T10:00:00.000Z') },
      { email: 'student@test.com', firstname: 'Marie', lastname: 'Martin', role: 'user', createdAt: new Date('2024-01-02T00:00:00.000Z') },
    ])

    await backfillBrevoContacts({ dryRun: true })

    expect(syncBrevoOwnerCreated).not.toHaveBeenCalled()
    expect(syncBrevoStudentCreated).not.toHaveBeenCalled()
    expect(closeDb).toHaveBeenCalledOnce()
  })

  it('applies the limit to the query', async () => {
    const query = mockSelect([
      { email: 'student@test.com', firstname: 'Marie', lastname: 'Martin', role: 'user', createdAt: new Date('2024-01-02T00:00:00.000Z') },
    ])

    await backfillBrevoContacts({ limit: 1 })

    expect(query.limit).toHaveBeenCalledWith(1)
  })

  it('continues and closes the db even when a Brevo sync fails', async () => {
    mockSelect([
      { email: 'ok@test.com', firstname: 'Marie', lastname: 'Martin', role: 'user', createdAt: new Date('2024-01-02T00:00:00.000Z') },
      { email: 'ko@test.com', firstname: 'Paul', lastname: 'Durand', role: 'user', createdAt: new Date('2024-01-02T00:00:00.000Z') },
    ])
    vi.mocked(syncBrevoStudentCreated).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Brevo 429'))

    await expect(backfillBrevoContacts({})).resolves.toBeUndefined()

    expect(syncBrevoStudentCreated).toHaveBeenCalledTimes(2)
    expect(closeDb).toHaveBeenCalledOnce()
  })
})
