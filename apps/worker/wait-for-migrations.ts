import fs from 'node:fs'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/db'
import { REPO_ROOT } from '~/server/jobs/repo-root'

const ZJournal = z.object({ entries: z.array(z.object({ when: z.number() })).min(1) })

const MISSING_RELATION_CODES = new Set(['42P01', '3F000'])

export function latestJournalMigration(journalPath = path.join(REPO_ROOT, 'drizzle/meta/_journal.json')): number {
  const { entries } = ZJournal.parse(JSON.parse(fs.readFileSync(journalPath, 'utf-8')))
  return Math.max(...entries.map((e) => e.when))
}

const pgErrorCode = (error: unknown): string | undefined => {
  const candidates = [error, (error as { cause?: unknown })?.cause]
  for (const candidate of candidates) {
    const code = (candidate as { code?: unknown })?.code
    if (typeof code === 'string') return code
  }
  return undefined
}

export async function latestAppliedMigration(): Promise<number | null> {
  try {
    const rows = await db.execute<{ max: string | number | null }>(sql`select max(created_at) as max from drizzle.__drizzle_migrations`)
    const max = rows[0]?.max
    return max === null || max === undefined ? null : Number(max)
  } catch (error) {
    if (MISSING_RELATION_CODES.has(pgErrorCode(error) ?? '')) return null
    throw error
  }
}

type WaitForMigrationsOptions = {
  timeoutMs?: number
  intervalMs?: number
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  readApplied?: () => Promise<number | null>
  expected?: number
}

export async function waitForMigrations({
  timeoutMs = 15 * 60_000,
  intervalMs = 10_000,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  readApplied = latestAppliedMigration,
  expected = latestJournalMigration(),
}: WaitForMigrationsOptions = {}): Promise<void> {
  const deadline = now() + timeoutMs
  let announced = false

  for (;;) {
    const applied = await readApplied()
    if (applied !== null && applied >= expected) return
    if (now() >= deadline) {
      throw new Error(`Worker : migrations Drizzle absentes après ${Math.round(timeoutMs / 60_000)} min`)
    }
    if (!announced) {
      console.log('Worker : en attente des migrations Drizzle…')
      announced = true
    }
    await sleep(intervalMs)
  }
}
