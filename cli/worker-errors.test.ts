import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ captureCliException: vi.fn(), notifyCronFailure: vi.fn() }))

vi.mock('./sentry', () => ({ captureCliException: mocks.captureCliException }))
vi.mock('./cron-failure', () => ({ notifyCronFailure: mocks.notifyCronFailure }))

import { reportWorkerJobError } from './worker-errors'

const startedAt = new Date('2026-11-14T04:00:00Z')
const error = new Error('boom')

beforeEach(() => {
  mocks.captureCliException.mockReset()
  mocks.notifyCronFailure.mockReset()
})

describe('reportWorkerJobError', () => {
  it.each([
    'requeue-pending-alerts',
    'report-alert-failures',
    'brevo-unblock-managers',
    'graphile-cleanup',
  ])('envoie %s à Sentry et prévient par mail', async (identifier) => {
    await reportWorkerJobError({ identifier, error, startedAt })

    expect(mocks.captureCliException).toHaveBeenCalledWith(error, { tags: { task: identifier } })
    expect(mocks.notifyCronFailure).toHaveBeenCalledWith({ job: identifier, error, startedAt })
  })

  it.each(['run-cli-command', 'send-alert-batch', 'detect-alerts'])('envoie %s à Sentry uniquement', async (identifier) => {
    await reportWorkerJobError({ identifier, error, startedAt })

    expect(mocks.captureCliException).toHaveBeenCalledWith(error, { tags: { task: identifier } })
    expect(mocks.notifyCronFailure).not.toHaveBeenCalled()
  })

  it('ne lève jamais, même si le reporting échoue', async () => {
    mocks.captureCliException.mockRejectedValueOnce(new Error('sentry down'))
    mocks.notifyCronFailure.mockRejectedValueOnce(new Error('brevo down'))

    await expect(reportWorkerJobError({ identifier: 'graphile-cleanup', error, startedAt })).resolves.toBeUndefined()
  })
})
