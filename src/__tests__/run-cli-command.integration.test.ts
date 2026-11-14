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

  it('transmet JOB_RUN_ID au process fils', async () => {
    await spawnAndRecord('env', ['node', '-e', 'process.exit(process.env.JOB_RUN_ID ? 0 : 5)'], 'manual')

    const [row] = await db.select().from(jobRuns)
    expect(row.status).toBe('done')
  })
})

describe('jobIdentifierFromArgs', () => {
  it('assemble les arguments hors options', () => {
    expect(jobIdentifierFromArgs(['import', 'arpej-ibail', '--owner-slug', 'arpej'])).toBe('import-arpej-ibail')
    expect(jobIdentifierFromArgs(['purge-logs'])).toBe('purge-logs')
  })
})
