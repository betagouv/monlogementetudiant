import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { and, eq } from 'drizzle-orm'
import { ELoginAttemptStatus } from '~/enums/login-attempt-status'
import { db } from '~/server/db'
import { user } from '~/server/db/schema/auth'
import { loginAttempts } from '~/server/db/schema/login-attempts'

/**
 * Durée de validité d'un lien de connexion, en secondes. Partagée entre la configuration du
 * plugin `magicLink` et le suivi : c'est elle qui permet de distinguer « jamais ouvert » de
 * « ouvert trop tard » sans relire la table `verification`, que Better Auth purge à l'usage.
 */
export const MAGIC_LINK_EXPIRES_IN_SECONDS = 600

/**
 * Empreinte du jeton. On ne conserve jamais le jeton en clair : cette table sert au suivi et ne
 * doit pas offrir un second exemplaire utilisable des liens de connexion.
 */
export const hashLoginToken = (token: string): string => createHash('sha256').update(token).digest('hex')

/** Enregistre l'envoi d'un lien de connexion. N'échoue jamais bruyamment : le suivi ne doit pas bloquer une connexion. */
export async function recordMagicLinkSent(params: { email: string; token: string }): Promise<void> {
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
    })
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'login-attempt-monitoring' } })
  }
}

/**
 * Enregistre l'issue d'une vérification de lien.
 *
 * Better Auth ne distingue pas le lien périmé du lien inconnu : les deux ressortent en
 * `INVALID_TOKEN`, parce que le jeton est consommé (donc supprimé) avant même que son expiration
 * soit regardée. C'est notre propre ligne, elle jamais purgée, qui permet de trancher.
 */
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

    if (!attempt) {
      // Jeton qu'on ne sait rattacher à aucun envoi : lien forgé, tronqué par un client mail, ou
      // émis avant la mise en place du suivi. `onConflictDoNothing` couvre le rejeu du même lien.
      await db
        .insert(loginAttempts)
        .values({ tokenHash, expiresAt: now, status: ELoginAttemptStatus.INVALID, verifiedAt: now, verifiedUserAgent: params.userAgent })
        .onConflictDoNothing()
      return
    }

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
