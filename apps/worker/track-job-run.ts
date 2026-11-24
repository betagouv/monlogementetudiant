import { notifyCronFailure } from '~/server/jobs/cron-failure'
import { finishJobRun } from '~/server/jobs/job-run'

type TTrackJobRun = {
  jobRunId: number | null
  timeoutMs: number | null
  job: string
  startedAt: Date
  run: () => Promise<void>
  finish?: typeof finishJobRun
  notify?: typeof notifyCronFailure
  exit?: (code: number) => void
}

const formatDuration = (ms: number) => (ms < 60_000 ? `${ms} ms` : `${Math.round(ms / 60_000)} min`)

export async function trackJobRun({
  jobRunId,
  timeoutMs,
  job,
  startedAt,
  run,
  finish = finishJobRun,
  notify = notifyCronFailure,
  exit = (code) => process.exit(code),
}: TTrackJobRun): Promise<void> {
  if (jobRunId === null) return run()

  const timer = timeoutMs
    ? setTimeout(() => {
        const error = new Error(`délai de ${formatDuration(timeoutMs)} dépassé, commande arrêtée`)
        void finish(jobRunId, error)
          .then(() => notify({ job, error, startedAt }))
          .finally(() => exit(1))
      }, timeoutMs)
    : undefined
  timer?.unref()

  try {
    await run()
    await finish(jobRunId)
  } catch (error) {
    await finish(jobRunId, error)
    throw error
  } finally {
    clearTimeout(timer)
  }
}
