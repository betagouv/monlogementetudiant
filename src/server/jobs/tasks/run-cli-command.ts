import { spawn } from 'node:child_process'
import path from 'node:path'
import type { Task } from 'graphile-worker'
import { z } from 'zod'
import { notifyCronFailure } from '~/server/jobs/cron-failure'
import { currentJobRunId, type TJobRunTrigger, withJobRun } from '~/server/jobs/job-run'
import { CLI_ENTRY, REPO_ROOT } from '~/server/jobs/repo-root'

const ZRunCliCommandPayload = z.object({ args: z.array(z.string()).min(1), timeoutMs: z.number().int().positive().optional() })

const formatDuration = (ms: number) => (ms < 60_000 ? `${ms} ms` : `${Math.round(ms / 60_000)} min`)

export function jobIdentifierFromArgs(args: string[]): string {
  const parts: string[] = []
  for (const arg of args) {
    if (arg.startsWith('-')) break
    parts.push(arg)
  }
  return parts.join('-')
}

export async function spawnAndRecord(
  identifier: string,
  command: string[],
  trigger: TJobRunTrigger,
  abortSignal?: AbortSignal,
  timeoutMs?: number,
): Promise<void> {
  await withJobRun(identifier, trigger, async () => {
    const [executable, ...args] = command
    let timedOut = false
    const startedAt = new Date()
    const outcome = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      const child = spawn(executable, args, {
        stdio: 'inherit',
        env: { ...process.env, JOB_RUN_ID: String(currentJobRunId()) },
      })
      const stop = () => child.kill('SIGTERM')
      if (abortSignal?.aborted) stop()
      abortSignal?.addEventListener('abort', stop, { once: true })
      const timer = timeoutMs
        ? setTimeout(() => {
            timedOut = true
            stop()
          }, timeoutMs)
        : undefined
      child.on('error', reject)
      child.on('close', (code, signal) => {
        clearTimeout(timer)
        abortSignal?.removeEventListener('abort', stop)
        resolve({ code, signal })
      })
    })
    if (timedOut && timeoutMs) {
      const error = new Error(`${identifier} : délai de ${formatDuration(timeoutMs)} dépassé, commande arrêtée`)
      await notifyCronFailure({ job: identifier, error, startedAt })
      throw error
    }
    if (outcome.code !== 0) {
      const reason = outcome.signal ? `signal ${outcome.signal}` : `code ${outcome.code}`
      throw new Error(`${identifier} a échoué (${reason})`)
    }
  })
}

export const runCliCommand: Task = async (payload, helpers) => {
  const { args, timeoutMs } = ZRunCliCommandPayload.parse(payload)
  const tsx = path.join(REPO_ROOT, 'node_modules/.bin/tsx')
  await spawnAndRecord(jobIdentifierFromArgs(args), [tsx, CLI_ENTRY, ...args], 'scheduled', helpers.abortSignal, timeoutMs)
}
