import { gunzipSync } from 'node:zlib'
import { subDays, subMonths } from 'date-fns'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTrackingEvent, createUser } from '../../../src/__tests__/fixtures/factories'
import { getTestDb } from '../../../src/__tests__/helpers/test-db'
import { ELoginAttemptStatus } from '../../../src/enums/login-attempt-status'
import { trackingEvents } from '../../../src/server/db/schema'
import { session, verification } from '../../../src/server/db/schema/auth'
import { loginAttempts } from '../../../src/server/db/schema/login-attempts'

interface CapturedUpload {
  key: string
  body: Buffer
  contentType: string
  metadata?: Record<string, string>
}

const uploads: CapturedUpload[] = []
const uploadPrivateFile = vi.fn(async (input: CapturedUpload) => {
  uploads.push(input)
})

// Mock partiel : seul l'envoi S3 est intercepté. Une factory qui n'énumère que
// `uploadPrivateFile` remplacerait tout le module, et le moindre export consommé
// ailleurs — `PURGE_ARCHIVE_PREFIX` dans `archiveKey`, par exemple — lèverait à l'accès.
vi.mock('~/server/services/s3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/server/services/s3')>()),
  uploadPrivateFile: (input: CapturedUpload) => uploadPrivateFile(input),
}))

const { purgeLogs } = await import('../purge-logs')

const db = getTestDb()

/** Relit une archive NDJSON gzippée telle qu'elle a été déposée dans S3. */
function readArchive(upload: CapturedUpload): Record<string, unknown>[] {
  return gunzipSync(upload.body)
    .toString('utf-8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

async function remainingTypes(): Promise<string[]> {
  const rows = await db.select({ type: trackingEvents.type }).from(trackingEvents).orderBy(trackingEvents.type)
  return rows.map((row) => row.type)
}

/** Au-delà de la rétention de 7 mois de `tracking_event`. */
const ANCIEN = subMonths(new Date(), 14)
const RECENT = subMonths(new Date(), 2)

describe('purge-logs — tracking_event', () => {
  beforeEach(() => {
    uploads.length = 0
    uploadPrivateFile.mockClear()
    // La commande journalise abondamment : on la fait taire pour garder une sortie de test lisible.
    vi.spyOn(console, 'log').mockImplementation(vi.fn())
    vi.spyOn(console, 'error').mockImplementation(vi.fn())
  })

  it('supprime les lignes au-delà de la rétention et conserve les récentes', async () => {
    await createTrackingEvent({ type: 'accommodation.viewed', createdAt: ANCIEN, sessionId: 'vieille-session' })
    await createTrackingEvent({ type: 'search.city', createdAt: ANCIEN })
    await createTrackingEvent({ type: 'accommodation.consult_offer', createdAt: RECENT })

    await purgeLogs({ table: 'tracking_event' })

    expect(await remainingTypes()).toEqual(['accommodation.consult_offer'])
  })

  it('archive dans S3 exactement les lignes supprimées, en NDJSON gzippé', async () => {
    await createTrackingEvent({ type: 'accommodation.viewed', createdAt: ANCIEN, sessionId: 'abc', metadata: { source: 'test' } })
    await createTrackingEvent({ type: 'search.city', createdAt: ANCIEN })
    await createTrackingEvent({ type: 'search.department', createdAt: RECENT })

    await purgeLogs({ table: 'tracking_event' })

    expect(uploads).toHaveLength(1)
    const [upload] = uploads

    expect(upload.key).toMatch(/^purges\/tracking_event\/\d{4}\/\d{2}\/tracking_event-[\dTZ-]+\.ndjson\.gz$/)
    expect(upload.contentType).toBe('application/gzip')
    expect(upload.metadata?.table).toBe('tracking_event')
    expect(upload.metadata?.rows).toBe('2')
    // La plage couverte permet d'identifier l'archive sans la décompresser.
    expect(upload.metadata?.['data-oldest']).toMatch(/^\d{4}-\d{2}-\d{2} /)
    expect(upload.metadata?.['data-newest']).toMatch(/^\d{4}-\d{2}-\d{2} /)

    const archived = readArchive(upload)
    expect(archived.map((row) => row.type)).toEqual(['accommodation.viewed', 'search.city'])
    // Le `jsonb` est restitué tel quel, et les colonnes vides restent des `null` typés.
    expect(archived[0].metadata).toEqual({ source: 'test' })
    expect(archived[0].session_id).toBe('abc')
    expect(archived[1].metadata).toBeNull()
  })

  it('ne dépose pas d’archive et ne supprime rien quand il n’y a rien à purger', async () => {
    await createTrackingEvent({ type: 'accommodation.viewed', createdAt: RECENT })

    await purgeLogs({ table: 'tracking_event' })

    expect(uploads).toHaveLength(0)
    expect(await remainingTypes()).toHaveLength(1)
  })

  it('ne supprime rien en dry-run', async () => {
    await createTrackingEvent({ type: 'accommodation.viewed', createdAt: ANCIEN })

    await purgeLogs({ table: 'tracking_event', dryRun: true })

    expect(uploads).toHaveLength(0)
    expect(await remainingTypes()).toHaveLength(1)
  })

  it('respecte --max-rows et laisse le reste pour le run suivant', async () => {
    await createTrackingEvent({ type: 'accommodation.viewed', createdAt: ANCIEN })
    await createTrackingEvent({ type: 'search.city', createdAt: ANCIEN })
    await createTrackingEvent({ type: 'search.department', createdAt: ANCIEN })

    await purgeLogs({ table: 'tracking_event', maxRows: 2 })
    expect(await remainingTypes()).toEqual(['search.department'])

    await purgeLogs({ table: 'tracking_event', maxRows: 2 })
    expect(await remainingTypes()).toEqual([])

    expect(uploads).toHaveLength(2)
    expect(readArchive(uploads[0])).toHaveLength(2)
    expect(readArchive(uploads[1])).toHaveLength(1)
  })

  it('supprime sans archiver avec --no-archive', async () => {
    await createTrackingEvent({ type: 'accommodation.viewed', createdAt: ANCIEN })
    await createTrackingEvent({ type: 'search.city', createdAt: RECENT })

    await purgeLogs({ table: 'tracking_event', noArchive: true })

    expect(uploads).toHaveLength(0)
    expect(await remainingTypes()).toEqual(['search.city'])
  })

  it('ne supprime rien si le dépôt de l’archive échoue', async () => {
    await createTrackingEvent({ type: 'accommodation.viewed', createdAt: ANCIEN })
    uploadPrivateFile.mockRejectedValueOnce(new Error('S3 indisponible'))

    await expect(purgeLogs({ table: 'tracking_event' })).rejects.toThrow('S3 indisponible')

    expect(await remainingTypes()).toEqual(['accommodation.viewed'])
  })

  it('rejette une table inconnue', async () => {
    await expect(purgeLogs({ table: 'accommodation' })).rejects.toThrow(/Table inconnue/)
  })
})

describe('purge-logs — login_attempt', () => {
  beforeEach(() => {
    uploads.length = 0
    vi.spyOn(console, 'log').mockImplementation(vi.fn())
  })

  const insertAttempt = (tokenHash: string, values: Partial<typeof loginAttempts.$inferInsert> = {}) =>
    db.insert(loginAttempts).values({ tokenHash, expiresAt: new Date(), ...values })

  it('supprime les tentatives au-delà de la rétention et les jetons inconnus orphelins', async () => {
    await insertAttempt('ancienne', { email: 'gest@bailleur.fr', createdAt: subMonths(new Date(), 13) })
    await insertAttempt('recente', { email: 'gest@bailleur.fr', createdAt: RECENT })
    await insertAttempt('orpheline', { status: ELoginAttemptStatus.INVALID, createdAt: RECENT })
    await insertAttempt('invalide-rattachee', { email: 'gest@bailleur.fr', status: ELoginAttemptStatus.INVALID, createdAt: RECENT })

    await purgeLogs({ table: 'login_attempt', noArchive: true })

    const rows = await db.select({ tokenHash: loginAttempts.tokenHash }).from(loginAttempts).orderBy(loginAttempts.tokenHash)
    expect(rows.map((row) => row.tokenHash)).toEqual(['invalide-rattachee', 'recente'])
  })
})

describe('purge-logs — sessions et jetons expirés', () => {
  beforeEach(async () => {
    uploads.length = 0
    vi.spyOn(console, 'log').mockImplementation(vi.fn())
    await createUser({ id: 'purge-user', email: 'purge-user@test.com' })
  })

  const insertSession = (id: string, expiresAt: Date) =>
    db.insert(session).values({ id, token: `token-${id}`, userId: 'purge-user', expiresAt, createdAt: new Date(), updatedAt: new Date() })

  it('supprime les sessions expirées depuis plus de 7 jours et les jetons de vérification expirés', async () => {
    await insertSession('expiree-ancienne', subDays(new Date(), 8))
    await insertSession('expiree-recente', subDays(new Date(), 2))
    await insertSession('active', new Date(Date.now() + 3_600_000))
    await db.insert(verification).values([
      { id: 'v-expiree', identifier: 'a', value: '{}', expiresAt: subDays(new Date(), 1) },
      { id: 'v-valide', identifier: 'b', value: '{}', expiresAt: new Date(Date.now() + 600_000) },
    ])

    await purgeLogs({ table: 'session' })
    await purgeLogs({ table: 'verification' })

    const sessions = await db.select({ id: session.id }).from(session).orderBy(session.id)
    expect(sessions.map((row) => row.id)).toEqual(['active', 'expiree-recente'])
    const verifications = await db.select({ id: verification.id }).from(verification)
    expect(verifications.map((row) => row.id)).toEqual(['v-valide'])
    expect(uploads).toHaveLength(0)
  })

  it('ne supprime rien en dry-run', async () => {
    await insertSession('expiree-ancienne', subDays(new Date(), 8))

    await purgeLogs({ table: 'session', dryRun: true })

    expect(await db.select().from(session)).toHaveLength(1)
  })
})
