import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { ELoginAttemptStatus, ELoginOutcome } from '~/enums/login-attempt-status'
import { loginAttempts } from '~/server/db/schema/login-attempts'
import { hashLoginToken, recordMagicLinkSent, recordMagicLinkVerification } from '~/server/services/login-attempts'
import { createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { adminCaller } from './helpers/test-caller'

const readAttempt = async (token: string) => {
  const db = getTestDb()
  const [row] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.tokenHash, hashLoginToken(token)))
    .limit(1)
  return row ?? null
}

/** Recule la date d'expiration d'une tentative pour simuler un lien périmé. */
const expireAttempt = async (token: string) => {
  const db = getTestDb()
  await db
    .update(loginAttempts)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(eq(loginAttempts.tokenHash, hashLoginToken(token)))
}

const today = () => new Date().toISOString().slice(0, 10)
const range = { from: '2000-01-01', to: today() }

beforeEach(async () => {
  await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })
})

describe('recordMagicLinkSent', () => {
  it('rattache le lien envoyé au compte et à son gestionnaire', async () => {
    await createUser({
      id: 'gest-id',
      name: 'Gestionnaire',
      email: 'gest@bailleur.fr',
      role: 'owner',
      firstname: 'Léa',
      lastname: 'Martin',
    })
    const owner = await createOwner({ name: 'Bailleur Connexion', slug: 'bailleur-connexion', userId: 'gest-id' })

    await recordMagicLinkSent({ email: 'gest@bailleur.fr', token: 'token-envoi' })

    const attempt = await readAttempt('token-envoi')
    expect(attempt).not.toBeNull()
    expect(attempt!.status).toBe(ELoginAttemptStatus.EMAIL_SENT)
    expect(attempt!.userId).toBe('gest-id')
    expect(attempt!.ownerId).toBe(owner.id)
    expect(attempt!.role).toBe('owner')
    expect(attempt!.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('ne stocke jamais le jeton en clair', async () => {
    await createUser({ id: 'gest-id', name: 'Gestionnaire', email: 'gest@bailleur.fr', role: 'owner' })

    await recordMagicLinkSent({ email: 'gest@bailleur.fr', token: 'jeton-secret' })

    const attempt = await readAttempt('jeton-secret')
    expect(attempt!.tokenHash).not.toBe('jeton-secret')
    expect(attempt!.tokenHash).toHaveLength(64)
  })
})

describe('recordMagicLinkVerification', () => {
  beforeEach(async () => {
    await createUser({ id: 'gest-id', name: 'Gestionnaire', email: 'gest@bailleur.fr', role: 'owner' })
    await createOwner({ name: 'Bailleur Connexion', slug: 'bailleur-connexion', userId: 'gest-id' })
  })

  it('marque la tentative comme aboutie', async () => {
    await recordMagicLinkSent({ email: 'gest@bailleur.fr', token: 'token-ok' })

    await recordMagicLinkVerification({ token: 'token-ok', success: true, userAgent: 'Mozilla/5.0' })

    const attempt = await readAttempt('token-ok')
    expect(attempt!.status).toBe(ELoginAttemptStatus.COMPLETED)
    expect(attempt!.verifiedAt).toBeInstanceOf(Date)
    expect(attempt!.verifiedUserAgent).toBe('Mozilla/5.0')
  })

  it('distingue le lien ouvert trop tard du lien simplement invalide', async () => {
    await recordMagicLinkSent({ email: 'gest@bailleur.fr', token: 'token-tardif' })
    await expireAttempt('token-tardif')
    await recordMagicLinkSent({ email: 'gest@bailleur.fr', token: 'token-rejoue' })

    await recordMagicLinkVerification({ token: 'token-tardif', success: false, userAgent: null })
    await recordMagicLinkVerification({ token: 'token-rejoue', success: false, userAgent: null })

    expect((await readAttempt('token-tardif'))!.status).toBe(ELoginAttemptStatus.EXPIRED)
    expect((await readAttempt('token-rejoue'))!.status).toBe(ELoginAttemptStatus.INVALID)
  })

  it('enregistre un jeton inconnu, sans jamais échouer sur un second passage', async () => {
    await recordMagicLinkVerification({ token: 'token-inconnu', success: false, userAgent: 'Scanner/1.0' })
    await recordMagicLinkVerification({ token: 'token-inconnu', success: false, userAgent: 'Scanner/1.0' })

    const attempt = await readAttempt('token-inconnu')
    expect(attempt!.status).toBe(ELoginAttemptStatus.INVALID)
    expect(attempt!.email).toBeNull()
  })

  it('ne rétrograde pas une connexion déjà aboutie si le lien est rouvert', async () => {
    await recordMagicLinkSent({ email: 'gest@bailleur.fr', token: 'token-double' })
    await recordMagicLinkVerification({ token: 'token-double', success: true, userAgent: null })

    await recordMagicLinkVerification({ token: 'token-double', success: false, userAgent: null })

    expect((await readAttempt('token-double'))!.status).toBe(ELoginAttemptStatus.COMPLETED)
  })
})

describe('admin.connections.list', () => {
  beforeEach(async () => {
    await createUser({
      id: 'gest-id',
      name: 'Gestionnaire',
      email: 'gest@bailleur.fr',
      role: 'owner',
      firstname: 'Léa',
      lastname: 'Martin',
    })
    await createOwner({ name: 'Bailleur Connexion', slug: 'bailleur-connexion', userId: 'gest-id' })
  })

  it('déduit « jamais ouvert » d’un lien expiré resté sans clic, et « en attente » d’un lien encore valide', async () => {
    await recordMagicLinkSent({ email: 'gest@bailleur.fr', token: 'token-oublie' })
    await expireAttempt('token-oublie')
    await recordMagicLinkSent({ email: 'gest@bailleur.fr', token: 'token-frais' })

    const result = await adminCaller.admin.connections.list({ page: 1, ...range })

    expect(result.outcomeCounts[ELoginOutcome.NEVER_CLICKED]).toBe(1)
    expect(result.outcomeCounts[ELoginOutcome.PENDING]).toBe(1)
    expect(result.total).toBe(2)
  })

  it('expose le compte et le gestionnaire, et mesure le délai d’ouverture', async () => {
    await recordMagicLinkSent({ email: 'gest@bailleur.fr', token: 'token-detail' })
    await recordMagicLinkVerification({ token: 'token-detail', success: true, userAgent: 'Mozilla/5.0' })

    const result = await adminCaller.admin.connections.list({ page: 1, ...range })

    const [item] = result.items
    expect(item.accountName).toBe('Léa Martin')
    expect(item.email).toBe('gest@bailleur.fr')
    expect(item.ownerName).toBe('Bailleur Connexion')
    expect(item.outcome).toBe(ELoginOutcome.COMPLETED)
    expect(item.delaySeconds).toBeGreaterThanOrEqual(0)
  })

  it('filtre sur une issue sans fausser la répartition affichée', async () => {
    await recordMagicLinkSent({ email: 'gest@bailleur.fr', token: 'token-a' })
    await recordMagicLinkVerification({ token: 'token-a', success: true, userAgent: null })
    await recordMagicLinkSent({ email: 'gest@bailleur.fr', token: 'token-b' })
    await expireAttempt('token-b')

    const result = await adminCaller.admin.connections.list({ page: 1, ...range, outcome: ELoginOutcome.NEVER_CLICKED })

    expect(result.total).toBe(1)
    expect(result.items[0].outcome).toBe(ELoginOutcome.NEVER_CLICKED)
    expect(result.outcomeCounts[ELoginOutcome.COMPLETED]).toBe(1)
  })

  it('cherche indifféremment par nom de gestionnaire, nom de compte ou e-mail', async () => {
    await createUser({ id: 'autre-id', name: 'Autre', email: 'autre@ailleurs.fr', role: 'owner', firstname: 'Paul', lastname: 'Durand' })
    await createOwner({ name: 'Autre Bailleur', slug: 'autre-bailleur', userId: 'autre-id' })
    await recordMagicLinkSent({ email: 'gest@bailleur.fr', token: 'token-lea' })
    await recordMagicLinkSent({ email: 'autre@ailleurs.fr', token: 'token-paul' })

    const parOwner = await adminCaller.admin.connections.list({ page: 1, ...range, search: 'Autre Bailleur' })
    const parNom = await adminCaller.admin.connections.list({ page: 1, ...range, search: 'Martin' })
    const parEmail = await adminCaller.admin.connections.list({ page: 1, ...range, search: 'ailleurs.fr' })

    expect(parOwner.items.map((i) => i.email)).toEqual(['autre@ailleurs.fr'])
    expect(parNom.items.map((i) => i.email)).toEqual(['gest@bailleur.fr'])
    expect(parEmail.items.map((i) => i.email)).toEqual(['autre@ailleurs.fr'])
  })

  it('borne les résultats à la période demandée', async () => {
    await recordMagicLinkSent({ email: 'gest@bailleur.fr', token: 'token-hier' })

    const horsPeriode = await adminCaller.admin.connections.list({ page: 1, from: '2000-01-01', to: '2000-01-31' })

    expect(horsPeriode.total).toBe(0)
  })
})

describe('admin.connections.strandedAccounts', () => {
  it('ne remonte que les comptes n’ayant jamais abouti sur la période', async () => {
    await createUser({ id: 'bloque-id', name: 'Bloqué', email: 'bloque@bailleur.fr', role: 'owner', firstname: 'Zoé', lastname: 'Bernard' })
    await createOwner({ name: 'Bailleur Bloqué', slug: 'bailleur-bloque', userId: 'bloque-id' })
    await createUser({ id: 'ok-id', name: 'OK', email: 'ok@bailleur.fr', role: 'owner' })

    await recordMagicLinkSent({ email: 'bloque@bailleur.fr', token: 'bloque-1' })
    await expireAttempt('bloque-1')
    await recordMagicLinkSent({ email: 'bloque@bailleur.fr', token: 'bloque-2' })
    await expireAttempt('bloque-2')
    await recordMagicLinkSent({ email: 'ok@bailleur.fr', token: 'ok-1' })
    await recordMagicLinkVerification({ token: 'ok-1', success: true, userAgent: null })

    const stranded = await adminCaller.admin.connections.strandedAccounts(range)

    expect(stranded).toHaveLength(1)
    expect(stranded[0].email).toBe('bloque@bailleur.fr')
    expect(stranded[0].accountName).toBe('Zoé Bernard')
    expect(stranded[0].ownerName).toBe('Bailleur Bloqué')
    expect(stranded[0].attempts).toBe(2)
  })
})
