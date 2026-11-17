import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '~/server/db'
import { jobRuns } from '~/server/db/schema'
import { CLI_ENTRY, REPO_ROOT } from '~/server/jobs/repo-root'
import { jobIdentifierFromArgs, launchCliCommand, runsOnScalingo, spawnAndRecord } from '~/server/jobs/tasks/run-cli-command'
import { cleanTables } from './helpers/test-db'

const mocks = vi.hoisted(() => ({ notifyCronFailure: vi.fn() }))
vi.mock('~/server/jobs/cron-failure', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/server/jobs/cron-failure')>()),
  notifyCronFailure: mocks.notifyCronFailure,
}))

describe('spawnAndRecord', () => {
  beforeEach(async () => {
    mocks.notifyCronFailure.mockReset()
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

  it('lance le point d’entrée du CLI depuis la racine du repo', async () => {
    expect(fs.existsSync(CLI_ENTRY)).toBe(true)
    await spawnAndRecord('help', [path.join(REPO_ROOT, 'node_modules/.bin/tsx'), CLI_ENTRY, '--help'], 'scheduled')

    const [row] = await db.select().from(jobRuns)
    expect(row.status).toBe('done')
  }, 30_000)

  it('enregistre une erreur quand l’exécutable est introuvable', async () => {
    await expect(spawnAndRecord('missing', ['/nonexistent/binary'], 'scheduled')).rejects.toThrow()

    const [row] = await db.select().from(jobRuns)
    expect(row.status).toBe('error')
  })

  it('tue le fils au-delà du délai et enregistre l’erreur', async () => {
    await expect(spawnAndRecord('trop-long', ['node', '-e', 'setTimeout(() => {}, 60000)'], 'scheduled', undefined, 300)).rejects.toThrow(
      'délai de 300 ms dépassé',
    )

    const [row] = await db.select().from(jobRuns)
    expect(row.status).toBe('error')
    expect(row.error).toContain('délai de 300 ms dépassé')
    expect(mocks.notifyCronFailure).toHaveBeenCalledWith(expect.objectContaining({ job: 'trop-long' }))
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

describe('launchCliCommand (Scalingo)', () => {
  const scalingo = { apiToken: 'tk', app: 'mle-worker', region: 'osc-secnum-fr1' }
  const args = ['import', 'fac-habitat', '--owner-slug', 'fac-habitat']

  beforeEach(async () => {
    mocks.notifyCronFailure.mockReset()
    await cleanTables()
  })

  it('crée la ligne job_run et lance un one-off qui la reprend', async () => {
    const launch = vi.fn().mockResolvedValue({ containerId: 'ctn-1' })

    await launchCliCommand(args, 45 * 60_000, scalingo, launch)

    const [row] = await db.select().from(jobRuns)
    expect(row).toMatchObject({ task: 'import-fac-habitat', trigger: 'scheduled', status: 'running' })
    expect(launch).toHaveBeenCalledWith({
      apiToken: 'tk',
      app: 'mle-worker',
      region: 'osc-secnum-fr1',
      command: 'npx tsx apps/worker/index.ts import fac-habitat --owner-slug fac-habitat',
      env: { JOB_RUN_ID: String(row.id), JOB_TIMEOUT_MS: String(45 * 60_000) },
    })
  })

  it('passe la ligne en erreur et prévient quand le lancement échoue', async () => {
    const launch = vi.fn().mockRejectedValue(new Error('Lancement du one-off Scalingo refusé : 403'))

    await expect(launchCliCommand(args, 45 * 60_000, scalingo, launch)).rejects.toThrow('403')

    const [row] = await db.select().from(jobRuns)
    expect(row).toMatchObject({ status: 'error', error: 'Lancement du one-off Scalingo refusé : 403' })
    expect(mocks.notifyCronFailure).toHaveBeenCalledWith(expect.objectContaining({ job: 'import-fac-habitat' }))
  })

  it('refuse de lancer sans SCALINGO_APP, avec ligne en erreur et mail', async () => {
    const launch = vi.fn()

    await expect(launchCliCommand(args, 45 * 60_000, { ...scalingo, app: undefined }, launch)).rejects.toThrow('SCALINGO_APP manquant')

    expect(launch).not.toHaveBeenCalled()
    const [row] = await db.select().from(jobRuns)
    expect(row).toMatchObject({ status: 'error' })
    expect(mocks.notifyCronFailure).toHaveBeenCalled()
  })

  it('refuse de lancer sans token Scalingo', async () => {
    const launch = vi.fn()

    await expect(launchCliCommand(args, 45 * 60_000, { ...scalingo, apiToken: undefined }, launch)).rejects.toThrow(
      'SCALINGO_API_TOKEN manquant',
    )
    expect(launch).not.toHaveBeenCalled()
  })
})

describe('runsOnScalingo', () => {
  it.each([
    [{ scalingoApp: 'mle-worker', container: undefined }, true],
    [{ scalingoApp: undefined, container: 'worker-1' }, true],
    [{ scalingoApp: undefined, container: undefined }, false],
  ])('%o → %s', (input, expected) => {
    expect(runsOnScalingo(input)).toBe(expected)
  })
})
