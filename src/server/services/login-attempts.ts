import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { and, count, desc, eq, gt, gte, inArray, isNotNull } from 'drizzle-orm'
import { ELoginAttemptStatus } from '~/enums/login-attempt-status'
import { db } from '~/server/db'
import { session, user } from '~/server/db/schema/auth'
import { loginAttempts } from '~/server/db/schema/login-attempts'

export const MAGIC_LINK_EXPIRES_IN_SECONDS = 600

export const hashLoginToken = (token: string): string => createHash('sha256').update(token).digest('hex')

/** Enregistre l'envoi d'un lien de connexion. N'échoue jamais bruyamment : le suivi ne doit pas bloquer une connexion. */
export async function recordMagicLinkSent(params: {
  email: string
  token: string
  bindingHash?: string | null
  ipHash?: string | null
}): Promise<void> {
  try {
    const account = await db.query.user.findFirst({
      where: eq(user.email, params.email),
      columns: { id: true, role: true, ownerId: true },
    })

    await db.insert(loginAttempts).values({
      email: params.email,
      userId: account?.id ?? null,
      ownerId: account?.ownerId ?? null,
      role: account?.role ?? null,
      tokenHash: hashLoginToken(params.token),
      expiresAt: new Date(Date.now() + MAGIC_LINK_EXPIRES_IN_SECONDS * 1000),
      status: ELoginAttemptStatus.EMAIL_SENT,
      bindingHash: params.bindingHash ?? null,
      ipHash: params.ipHash ?? null,
    })
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'login-attempt-monitoring' } })
  }
}

export async function recordMagicLinkVerification(params: { token: string; success: boolean; userAgent: string | null }): Promise<void> {
  try {
    const tokenHash = hashLoginToken(params.token)
    const now = new Date()

    if (params.success) {
      await db
        .update(loginAttempts)
        .set({ status: ELoginAttemptStatus.COMPLETED, verifiedAt: now, verifiedUserAgent: params.userAgent })
        .where(and(eq(loginAttempts.tokenHash, tokenHash), eq(loginAttempts.status, ELoginAttemptStatus.EMAIL_SENT)))
      return
    }

    const [attempt] = await db.select().from(loginAttempts).where(eq(loginAttempts.tokenHash, tokenHash)).limit(1)

    // Jeton rattaché à aucun envoi : rien à suivre dans l'écran « Connexions ».
    if (!attempt) return

    // Une issue déjà enregistrée ne se réécrit pas : un lien rouvert après une connexion réussie
    // (retour arrière, second clic) ne doit pas transformer un succès en échec.
    if (attempt.status !== ELoginAttemptStatus.EMAIL_SENT) return

    await db
      .update(loginAttempts)
      .set({
        status: attempt.expiresAt < now ? ELoginAttemptStatus.EXPIRED : ELoginAttemptStatus.INVALID,
        verifiedAt: now,
        verifiedUserAgent: params.userAgent,
      })
      .where(eq(loginAttempts.id, attempt.id))
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'login-attempt-monitoring' } })
  }
}

const SEND_WINDOW_MS = MAGIC_LINK_EXPIRES_IN_SECONDS * 1000
const MAX_SENDS_PER_EMAIL = 3
const MAX_SENDS_PER_IP = 10

export async function isLoginSendRateLimited(params: { email: string; ipHash: string | null }): Promise<boolean> {
  const since = new Date(Date.now() - SEND_WINDOW_MS)
  const [byEmail] = await db
    .select({ total: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, params.email), gte(loginAttempts.createdAt, since)))
  if ((byEmail?.total ?? 0) >= MAX_SENDS_PER_EMAIL) return true

  if (!params.ipHash) return false
  const [byIp] = await db
    .select({ total: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ipHash, params.ipHash), gte(loginAttempts.createdAt, since)))
  return (byIp?.total ?? 0) >= MAX_SENDS_PER_IP
}

export async function findLoginAttemptByToken(token: string) {
  const [attempt] = await db
    .select({
      email: loginAttempts.email,
      role: loginAttempts.role,
      status: loginAttempts.status,
      expiresAt: loginAttempts.expiresAt,
      bindingHash: loginAttempts.bindingHash,
    })
    .from(loginAttempts)
    .where(eq(loginAttempts.tokenHash, hashLoginToken(token)))
    .limit(1)
  return attempt ?? null
}

/** Liens encore utilisables d'un email, avec l'identifiant `verification` correspondant (`storeToken: 'hashed'`). */
export async function findPendingMagicLinks(email: string) {
  const rows = await db
    .select({ id: loginAttempts.id, tokenHash: loginAttempts.tokenHash })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.email, email),
        eq(loginAttempts.status, ELoginAttemptStatus.EMAIL_SENT),
        gt(loginAttempts.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(loginAttempts.createdAt))
  return rows.map((row) => ({ id: row.id, verificationIdentifier: Buffer.from(row.tokenHash, 'hex').toString('base64url') }))
}

export async function recordOtpSignIn(params: { attemptId: number; userAgent: string | null }): Promise<void> {
  try {
    await db
      .update(loginAttempts)
      .set({ status: ELoginAttemptStatus.COMPLETED, verifiedAt: new Date(), verifiedUserAgent: params.userAgent })
      .where(and(eq(loginAttempts.id, params.attemptId), eq(loginAttempts.status, ELoginAttemptStatus.EMAIL_SENT)))
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'login-attempt-monitoring' } })
  }
}

export async function recordMagicLinkSession(params: { token: string; sessionId: string }): Promise<void> {
  try {
    await db
      .update(loginAttempts)
      .set({ sessionId: params.sessionId })
      .where(eq(loginAttempts.tokenHash, hashLoginToken(params.token)))
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'login-attempt-monitoring' } })
  }
}

/**
 * Le gestionnaire revient avec un lien déjà consommé : la session ouverte par cette consommation
 * n'est pas la sienne (scanner de mails), on la ferme.
 */
export async function revokeSessionsFromConsumedLinks(email: string): Promise<void> {
  const consumed = await db
    .select({ id: loginAttempts.id, sessionId: loginAttempts.sessionId })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.email, email),
        eq(loginAttempts.status, ELoginAttemptStatus.COMPLETED),
        isNotNull(loginAttempts.sessionId),
        gt(loginAttempts.expiresAt, new Date()),
      ),
    )
  const sessionIds = consumed.flatMap((row) => (row.sessionId ? [row.sessionId] : []))
  if (sessionIds.length === 0) return

  await db.delete(session).where(inArray(session.id, sessionIds))
  await db
    .update(loginAttempts)
    .set({ sessionId: null })
    .where(
      inArray(
        loginAttempts.id,
        consumed.map((row) => row.id),
      ),
    )
}
