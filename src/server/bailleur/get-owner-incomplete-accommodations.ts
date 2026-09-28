import { and, eq, exists, isNull, not, or, sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { accommodations } from '~/server/db/schema/accommodations'

const typologiesOf = (where?: ReturnType<typeof or>) =>
  db
    .select({ one: sql`1` })
    .from(accommodationTypologies)
    .where(and(eq(accommodationTypologies.accommodationId, accommodations.id), where))

const isIncomplete = or(
  isNull(accommodations.residenceType),
  eq(accommodations.residenceType, ''),
  isNull(accommodations.targetAudience),
  isNull(accommodations.scholarshipHoldersPriority),
  isNull(accommodations.socialHousingRequired),
  isNull(accommodations.acceptWaitingList),
  isNull(accommodations.nbAccessibleApartments),
  sql`coalesce(cardinality(${accommodations.imagesUrls}), 0) = 0`,
  not(exists(typologiesOf())),
  exists(
    typologiesOf(
      or(
        isNull(accommodationTypologies.priceMin),
        isNull(accommodationTypologies.priceMax),
        isNull(accommodationTypologies.superficieMin),
        isNull(accommodationTypologies.superficieMax),
      ),
    ),
  ),
)

export const getOwnerIncompleteAccommodations = async (ownerId: number): Promise<{ name: string; slug: string }[]> =>
  db
    .select({ name: accommodations.name, slug: accommodations.slug })
    .from(accommodations)
    .where(and(eq(accommodations.ownerId, ownerId), isIncomplete))
    .orderBy(accommodations.name)
