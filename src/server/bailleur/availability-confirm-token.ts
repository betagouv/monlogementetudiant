import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { env } from '~/server/env'
import { DAY_MS } from '~/utils/time'

/**
 * Jeton glissé dans les e-mails de disponibilités pour « Rien n'a changé » sans connexion.
 *
 * Il ne vaut ni session ni connexion : il n'ouvre que la confirmation des disponibilités du
 * destinataire, dans son périmètre recalculé au clic, et seulement pour les valeurs inchangées
 * depuis l'envoi (`issuedAt`). Il n'est pas à usage unique : l'action est idempotente.
 */
const PURPOSE = 'availability-confirm'
const TOKEN_TTL_MS = 35 * DAY_MS

const ZPayload = z.object({
  purpose: z.literal(PURPOSE),
  userId: z.string().min(1),
  ownerId: z.number().int().positive(),
  onlyWarned: z.boolean(),
  iat: z.number(),
  exp: z.number(),
})

export type TAvailabilityConfirmGrant = { userId: string; ownerId: number; onlyWarned: boolean; issuedAt: Date }

export type TAvailabilityConfirmTokenResult = { ok: true; grant: TAvailabilityConfirmGrant } | { ok: false; reason: 'invalid' | 'expired' }

const sign = (payload: string) => createHmac('sha256', env.AUTH_SECRET).update(`${PURPOSE}:${payload}`).digest('base64url')

export const createAvailabilityConfirmToken = (
  { userId, ownerId, onlyWarned }: Omit<TAvailabilityConfirmGrant, 'issuedAt'>,
  issuedAt: Date,
): string => {
  const iat = issuedAt.getTime()
  const payload = Buffer.from(JSON.stringify({ purpose: PURPOSE, userId, ownerId, onlyWarned, iat, exp: iat + TOKEN_TTL_MS })).toString(
    'base64url',
  )
  return `${payload}.${sign(payload)}`
}

export const verifyAvailabilityConfirmToken = (token: string, now = new Date()): TAvailabilityConfirmTokenResult => {
  const [payload, signature, ...rest] = token.split('.')
  if (!payload || !signature || rest.length > 0) return { ok: false, reason: 'invalid' }

  const expected = Buffer.from(sign(payload))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return { ok: false, reason: 'invalid' }

  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  const parsed = ZPayload.safeParse(decoded)
  if (!parsed.success) return { ok: false, reason: 'invalid' }
  if (parsed.data.exp < now.getTime()) return { ok: false, reason: 'expired' }

  const { userId, ownerId, onlyWarned, iat } = parsed.data
  return { ok: true, grant: { userId, ownerId, onlyWarned, issuedAt: new Date(iat) } }
}
