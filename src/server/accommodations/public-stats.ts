import { eq, sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { crousExistsCondition } from '~/server/accommodations/list-query'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { floorToStep } from '~/utils/floor-to-step'

const RESIDENCES_STEP = 100
const LOGEMENTS_STEP = 1000

export const getPublicAccommodationStats = unstable_cache(
  async () => {
    const [row] = await db
      .select({
        residences: sql<number>`count(*)`.mapWith(Number),
        logements: sql<number>`coalesce(sum(${accommodations.nbTotalApartments}) filter (where not ${crousExistsCondition}), 0)`.mapWith(
          Number,
        ),
      })
      .from(accommodations)
      .where(eq(accommodations.published, true))

    return {
      residences: floorToStep(row?.residences ?? 0, RESIDENCES_STEP),
      logements: floorToStep(row?.logements ?? 0, LOGEMENTS_STEP),
    }
  },
  ['public-accommodation-stats'],
  { revalidate: 3600 },
)
