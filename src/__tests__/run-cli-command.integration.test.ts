import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '~/server/db'
import { jobRuns } from '~/server/db/schema'
import { jobIdentifierFromArgs, spawnAndRecord } from '~/server/jobs/tasks/run-cli-command'
import { cleanTables } from './helpers/test-db'

describe('spawnAndRecord', () => {
  beforeEach(async () => {
    await cleanTables()
  })

  it('enregistre une exécution réussie', async () => {
    await spawnAndRecord('ok', ['node', '-e', 'process.exit(0)'], 'scheduled')

    const [row] = await db.select().from(jobRuns)
    expect(row).toMatchObject({ task: 'ok', trigger: 'scheduled', status: 'done' })
  })

  it('enregistre le code de sortie en cas d’échec', async () => {
    await expect(spawnAndRecord('ko', ['node', '-e', 'process.exit(3)'], 'scheduled')).rejects.toThrow('code 3')

    const [row] = await db.select().from(jobRuns)
    expect(row.status).toBe('error')
    expect(row.error).toContain('code 3')
  })

  it('transmet au fils l’identifiant de la ligne job_run', async () => {
    const file = path.join(os.tmpdir(), `job-run-id-${process.pid}-${Date.now()}`)
    await spawnAndRecord(
      'env',
      ['node', '-e', `require('node:fs').writeFileSync(${JSON.stringify(file)}, process.env.JOB_RUN_ID ?? '')`],
      'manual',
    )

    const [row] = await db.select().from(jobRuns)
    expect(row.status).toBe('done')
    expect(fs.readFileSync(file, 'utf-8')).toBe(String(row.id))
    fs.rmSync(file)
  })

  it('enregistre une erreur quand l’exécutable est introuvable', async () => {
    await expect(spawnAndRecord('missing', ['/nonexistent/binary'], 'scheduled')).rejects.toThrow()

    const [row] = await db.select().from(jobRuns)
    expect(row.status).toBe('error')
  })

  it('arrête le fils et mentionne le signal à l’abandon', async () => {
    const controller = new AbortController()
    const promise = spawnAndRecord('abort', ['node', '-e', 'setTimeout(() => {}, 60000)'], 'scheduled', controller.signal)
    setTimeout(() => controller.abort(), 500)

    await expect(promise).rejects.toThrow('signal SIGTERM')
    const [row] = await db.select().from(jobRuns)
    expect(row.status).toBe('error')
  })
})

describe('jobIdentifierFromArgs', () => {
  it('assemble les arguments hors options', () => {
    expect(jobIdentifierFromArgs(['import', 'arpej-ibail', '--owner-slug', 'arpej'])).toBe('import-arpej-ibail')
    expect(jobIdentifierFromArgs(['purge-logs'])).toBe('purge-logs')
  })
})
