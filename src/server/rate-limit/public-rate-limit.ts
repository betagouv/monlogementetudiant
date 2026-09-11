import { createHmac } from 'node:crypto'
import { TRPCError } from '@trpc/server'
import { sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { publicRateLimits } from '~/server/db/schema'
import { env } from '~/server/env'

type PublicRateLimitOptions = {
  clientIp: string | null
  scope: string
  maxRequests: number
  windowMs: number
}

function rateLimitKey(scope: string, clientIp: string): string {
  return createHmac('sha256', env.AUTH_SECRET).update(`${scope}\0${clientIp}`).digest('base64url')
}

/**
 * Fixed-window rate-limit partagé par toutes les instances de l'application.
 * L'UPSERT fait l'incrément et le reset en une seule requête afin que des appels concurrents
 * ne puissent pas dépasser silencieusement la limite.
 */
export async function assertPublicRateLimit({ clientIp, scope, maxRequests, windowMs }: PublicRateLimitOptions): Promise<void> {
  if (!clientIp) return

  const key = rateLimitKey(scope, clientIp)
  const now = new Date()
  const nextExpiry = new Date(now.getTime() + windowMs)
  const encodedNow = sql.param(now, publicRateLimits.expiresAt)
  const encodedNextExpiry = sql.param(nextExpiry, publicRateLimits.expiresAt)

  const [bucket] = await db
    .insert(publicRateLimits)
    .values({ key, count: 1, expiresAt: nextExpiry, updatedAt: now })
    .onConflictDoUpdate({
      target: publicRateLimits.key,
      set: {
        count: sql`CASE WHEN ${publicRateLimits.expiresAt} <= ${encodedNow} THEN 1 ELSE ${publicRateLimits.count} + 1 END`,
        expiresAt: sql`CASE WHEN ${publicRateLimits.expiresAt} <= ${encodedNow} THEN ${encodedNextExpiry} ELSE ${publicRateLimits.expiresAt} END`,
        updatedAt: now,
      },
    })
    .returning({ count: publicRateLimits.count })

  if ((bucket?.count ?? 0) > maxRequests) {
    throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Trop de requêtes. Veuillez réessayer plus tard.' })
  }
}

export const _internal = { rateLimitKey }
