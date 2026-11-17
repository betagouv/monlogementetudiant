import { spawn } from 'node:child_process'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import type { Task } from 'graphile-worker'
import { z } from 'zod'
import { db } from '~/server/db'
import { jobRuns } from '~/server/db/schema'
import { env } from '~/server/env'
import { notifyCronFailure } from '~/server/jobs/cron-failure'
import { currentJobRunId, type TJobRunTrigger, withJobRun } from '~/server/jobs/job-run'
import { CLI_ENTRY, REPO_ROOT } from '~/server/jobs/repo-root'
import { DEFAULT_CLI_TIMEOUT_MINUTES } from '~/server/jobs/schedule'
import { runDetachedOneOff } from '~/server/services/scalingo'

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

type TScalingoTarget = { apiToken: string | undefined; app: string | undefined; region: string }

export const runsOnScalingo = ({ scalingoApp, container }: { scalingoApp?: string; container?: string }) =>
  Boolean(scalingoApp || container)

export async function launchCliCommand(
  args: string[],
  timeoutMs: number,
  scalingo: TScalingoTarget,
  launch: typeof runDetachedOneOff = runDetachedOneOff,
): Promise<void> {
  const identifier = jobIdentifierFromArgs(args)
  const startedAt = new Date()
  const [run] = await db.insert(jobRuns).values({ task: identifier, trigger: 'scheduled' }).returning({ id: jobRuns.id })

  try {
    if (!scalingo.app) throw new Error('SCALINGO_APP manquant : impossible de lancer le one-off')
    if (!scalingo.apiToken) throw new Error('SCALINGO_API_TOKEN manquant : impossible de lancer le one-off')
    await launch({
      apiToken: scalingo.apiToken,
      app: scalingo.app,
      region: scalingo.region,
      command: `npx tsx apps/worker/index.ts ${args.join(' ')}`,
      env: { JOB_RUN_ID: String(run.id), JOB_TIMEOUT_MS: String(timeoutMs) },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await db.update(jobRuns).set({ status: 'error', endedAt: new Date(), error: message }).where(eq(jobRuns.id, run.id))
    await notifyCronFailure({ job: identifier, error, startedAt })
    throw error
  }
}

export const runCliCommand: Task = async (payload, helpers) => {
  const { args, timeoutMs } = ZRunCliCommandPayload.parse(payload)
  if (runsOnScalingo({ scalingoApp: env.SCALINGO_APP, container: process.env.CONTAINER })) {
    await launchCliCommand(args, timeoutMs ?? DEFAULT_CLI_TIMEOUT_MINUTES * 60_000, {
      apiToken: env.SCALINGO_API_TOKEN,
      app: env.SCALINGO_APP,
      region: env.SCALINGO_REGION,
    })
    return
  }
  const tsx = path.join(REPO_ROOT, 'node_modules/.bin/tsx')
  await spawnAndRecord(jobIdentifierFromArgs(args), [tsx, CLI_ENTRY, ...args], 'scheduled', helpers.abortSignal, timeoutMs)
}
