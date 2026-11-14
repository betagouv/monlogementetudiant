import * as Sentry from '@sentry/nextjs'
import { db } from '~/server/db'
import { enqueueJob } from '~/server/jobs/enqueue'

// best effort
export async function triggerAlertDetection(accommodationIds: number[]): Promise<void> {
  if (accommodationIds.length === 0) return
  try {
    await enqueueJob(db, 'detect-alerts', { accommodationIds }, { maxAttempts: 3 })
  } catch (error) {
    console.error('[alert-detection] échec de la mise en file de la détection:', error)
    Sentry.captureException(error)
  }
}
