import { spawn } from 'node:child_process'
import path from 'node:path'
import type { Task } from 'graphile-worker'
import { z } from 'zod'
import { currentJobRunId, type TJobRunTrigger, withJobRun } from '~/server/jobs/job-run'

const ZRunCliCommandPayload = z.object({ args: z.array(z.string()).min(1) })

export function jobIdentifierFromArgs(args: string[]): string {
  const parts: string[] = []
  for (const arg of args) {
    if (arg.startsWith('-')) break
    parts.push(arg)
  }
  return parts.join('-')
}

export async function spawnAndRecord(identifier: string, command: string[], trigger: TJobRunTrigger): Promise<void> {
  await withJobRun(identifier, trigger, async () => {
    const [executable, ...args] = command
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(executable, args, {
        stdio: 'inherit',
        env: { ...process.env, JOB_RUN_ID: String(currentJobRunId()) },
      })
      child.on('error', reject)
      child.on('close', resolve)
    })
    if (exitCode !== 0) throw new Error(`${identifier} a échoué (code ${exitCode})`)
  })
}

export const runCliCommand: Task = async (payload) => {
  const { args } = ZRunCliCommandPayload.parse(payload)
  const tsx = path.resolve(process.cwd(), 'node_modules/.bin/tsx')
  await spawnAndRecord(jobIdentifierFromArgs(args), [tsx, path.resolve(process.cwd(), 'cli/index.ts'), ...args], 'scheduled')
}
