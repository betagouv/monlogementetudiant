import { eq, max } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { accommodations } from '~/server/db/schema/accommodations'

export const getOwnerLastAvailabilityUpdate = async (ownerId: number): Promise<Date | null> => {
  const [row] = await db
    .select({ lastUpdate: max(accommodationTypologies.availabilityUpdatedAt) })
    .from(accommodationTypologies)
    .innerJoin(accommodations, eq(accommodations.id, accommodationTypologies.accommodationId))
    .where(eq(accommodations.ownerId, ownerId))
  return row?.lastUpdate ?? null
}
