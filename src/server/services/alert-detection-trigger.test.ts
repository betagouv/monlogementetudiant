import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ enqueueJob: vi.fn(), captureException: vi.fn() }))

vi.mock('~/server/db', () => ({ db: {} }))
vi.mock('~/server/jobs/enqueue', () => ({ enqueueJob: mocks.enqueueJob }))
vi.mock('@sentry/nextjs', () => ({ captureException: mocks.captureException }))

import { triggerAlertDetection } from './alert-detection-trigger'

describe('triggerAlertDetection', () => {
  beforeEach(() => {
    mocks.enqueueJob.mockReset()
    mocks.captureException.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('met en file une tâche detect-alerts', async () => {
    await triggerAlertDetection([1, 2])

    expect(mocks.enqueueJob).toHaveBeenCalledWith(expect.anything(), 'detect-alerts', { accommodationIds: [1, 2] })
  })

  it('ne met rien en file sans résidence', async () => {
    await triggerAlertDetection([])

    expect(mocks.enqueueJob).not.toHaveBeenCalled()
  })

  it('ne lève pas si la mise en file échoue', async () => {
    mocks.enqueueJob.mockRejectedValue(new Error('base indisponible'))

    await expect(triggerAlertDetection([1])).resolves.toBeUndefined()
    expect(mocks.captureException).toHaveBeenCalledTimes(1)
  })
})
