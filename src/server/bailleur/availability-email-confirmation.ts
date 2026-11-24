import { eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { user } from '~/server/db/schema/auth'
import { owners } from '~/server/db/schema/owners'
import { getAccommodationScope } from './accommodation-scope'
import { type TAvailabilityConfirmTokenResult, verifyAvailabilityConfirmToken } from './availability-confirm-token'
import { confirmAvailability, listAvailabilityToConfirm } from './availability-confirmation'
import { hasPermission } from './permissions'

export const AVAILABILITY_CONFIRM_COOKIE = 'mle_dispo_confirm'

export type TEmailConfirmationFailure = 'invalid' | 'expired'

/** Droits du destinataire relus au clic : un compte banni, sorti du bailleur ou sans `manage_residences` n'a plus rien. */
async function resolveGrant(token: TAvailabilityConfirmTokenResult) {
  if (!token.ok) return { ok: false as const, reason: token.reason }
  const { grant } = token

  const recipient = await db.query.user.findFirst({
    where: eq(user.id, grant.userId),
    columns: { id: true, name: true, role: true, banned: true, ownerId: true, bailleurRole: true, bailleurPermissions: true },
  })
  if (
    !recipient ||
    recipient.role !== 'owner' ||
    recipient.banned ||
    recipient.ownerId !== grant.ownerId ||
    !hasPermission(
      { role: recipient.role, bailleurRole: recipient.bailleurRole, bailleurPermissions: recipient.bailleurPermissions },
      'manage_residences',
    )
  ) {
    return { ok: false as const, reason: 'invalid' as const }
  }

  const owner = await db.query.owners.findFirst({ where: eq(owners.id, grant.ownerId), columns: { id: true, name: true } })
  if (!owner) return { ok: false as const, reason: 'invalid' as const }

  return { ok: true as const, grant, owner, recipient, scope: await getAccommodationScope(recipient.id) }
}

export async function readEmailConfirmation(rawToken: string | undefined) {
  const resolved = await resolveGrant(rawToken ? verifyAvailabilityConfirmToken(rawToken) : { ok: false, reason: 'invalid' })
  if (!resolved.ok) return resolved

  const residences = await listAvailabilityToConfirm(resolved.owner.id, resolved.scope, { onlyWarned: resolved.grant.onlyWarned })
  return {
    ok: true as const,
    issuedAt: resolved.grant.issuedAt,
    residences: residences.map(({ id, name, city, nbAvailable, lastUpdatedAt }) => ({ id, name, city, nbAvailable, lastUpdatedAt })),
  }
}

export async function confirmFromEmail(rawToken: string | undefined) {
  const resolved = await resolveGrant(rawToken ? verifyAvailabilityConfirmToken(rawToken) : { ok: false, reason: 'invalid' })
  if (!resolved.ok) return resolved

  const result = await confirmAvailability({
    owner: resolved.owner,
    scope: resolved.scope,
    user: { id: resolved.recipient.id, name: resolved.recipient.name },
    onlyWarned: resolved.grant.onlyWarned,
    notUpdatedSince: resolved.grant.issuedAt,
    via: 'email',
  })
  return { ok: true as const, ...result }
}
