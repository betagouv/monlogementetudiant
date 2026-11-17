import { afterEach, describe, expect, it, vi } from 'vitest'
import { trackJobRun } from '../track-job-run'

vi.mock('~/server/db', () => ({ db: {} }))

const deps = () => ({ finish: vi.fn().mockResolvedValue(undefined), notify: vi.fn().mockResolvedValue(true), exit: vi.fn() })
const startedAt = new Date('2026-11-17T10:00:00Z')

afterEach(() => {
  vi.useRealTimers()
})

describe('trackJobRun', () => {
  it('exécute simplement la commande sans JOB_RUN_ID', async () => {
    const d = deps()
    const run = vi.fn().mockResolvedValue(undefined)
    await trackJobRun({ jobRunId: null, timeoutMs: null, job: 'sync stats', startedAt, run, ...d })
    expect(run).toHaveBeenCalled()
    expect(d.finish).not.toHaveBeenCalled()
  })

  it('clôt la ligne en succès', async () => {
    const d = deps()
    await trackJobRun({ jobRunId: 7, timeoutMs: 60_000, job: 'sync stats', startedAt, run: () => Promise.resolve(), ...d })
    expect(d.finish).toHaveBeenCalledWith(7)
  })

  it('clôt la ligne en erreur et relance l’erreur', async () => {
    const d = deps()
    const error = new Error('boum')
    await expect(
      trackJobRun({ jobRunId: 7, timeoutMs: 60_000, job: 'sync stats', startedAt, run: () => Promise.reject(error), ...d }),
    ).rejects.toThrow('boum')
    expect(d.finish).toHaveBeenCalledWith(7, error)
  })

  it('arrête la commande au-delà du délai, avec mail', async () => {
    vi.useFakeTimers()
    const d = deps()
    void trackJobRun({ jobRunId: 7, timeoutMs: 45 * 60_000, job: 'import fac-habitat', startedAt, run: () => new Promise(vi.fn()), ...d })

    await vi.advanceTimersByTimeAsync(45 * 60_000)

    expect(d.finish).toHaveBeenCalledWith(7, expect.objectContaining({ message: 'délai de 45 min dépassé, commande arrêtée' }))
    expect(d.notify).toHaveBeenCalledWith(expect.objectContaining({ job: 'import fac-habitat', startedAt }))
    expect(d.exit).toHaveBeenCalledWith(1)
  })
})
