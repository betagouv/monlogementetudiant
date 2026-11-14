import type { Task } from 'graphile-worker'
import { z } from 'zod'
import { recordJobMetrics, withJobRun } from '~/server/jobs/job-run'
import { sendAlertBatch } from '~/server/services/alert-sender'

const ZSendAlertBatchPayload = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('alert'), studentAlertId: z.number().int().positive() }),
  z.object({ kind: z.literal('favorite'), userId: z.string().min(1) }),
])

export const sendAlertBatchTask: Task = async (payload, helpers) => {
  const key = ZSendAlertBatchPayload.parse(payload)
  await withJobRun('send-alert-batch', 'event', async () => {
    const { sent, housings, failed } = await sendAlertBatch(key, { number: helpers.job.attempts, max: helpers.job.max_attempts })
    await recordJobMetrics({ emails: sent ? 1 : 0, housings, failed: failed ? 1 : 0 })
  })
}
