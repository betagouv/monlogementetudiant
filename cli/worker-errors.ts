import { SCHEDULED_IN_PROCESS } from '~/server/jobs/schedule'
import { notifyCronFailure } from './cron-failure'
import { captureCliException } from './sentry'

const MAILED_TASKS = new Set<string>(SCHEDULED_IN_PROCESS.map(({ identifier }) => identifier))

type TWorkerJobError = { identifier: string; error: unknown; startedAt: Date }

export async function reportWorkerJobError({ identifier, error, startedAt }: TWorkerJobError): Promise<void> {
  const reports: Promise<unknown>[] = [captureCliException(error, { tags: { task: identifier } })]
  if (MAILED_TASKS.has(identifier)) reports.push(notifyCronFailure({ job: identifier, error, startedAt }))
  await Promise.allSettled(reports)
}
