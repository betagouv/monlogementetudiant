import { eq, type SQL } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { user } from '~/server/db/schema/auth'
import { getAccommodationScope, scopeAllowsAccommodationId } from './accommodation-scope'

export type AccommodationAccess = 'ok' | 'not_found' | 'forbidden'

export async function checkAccommodationAccess(userId: string, accommodationWhere: SQL): Promise<AccommodationAccess> {
  const usr = await db.query.user.findFirst({ where: eq(user.id, userId), with: { owner: true } })
  if (usr?.role === 'admin') return 'ok'

  const [accommodation] = await db
    .select({ id: accommodations.id, ownerId: accommodations.ownerId })
    .from(accommodations)
    .where(accommodationWhere)
    .limit(1)

  if (!accommodation) return 'not_found'
  if (!usr?.owner || accommodation.ownerId !== usr.owner.id) return 'forbidden'

  // Hors périmètre : même réponse qu'une résidence inexistante.
  const scope = await getAccommodationScope(userId)
  return scopeAllowsAccommodationId(scope, accommodation.id) ? 'ok' : 'not_found'
}
