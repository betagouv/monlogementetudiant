import { sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { cities } from '~/server/db/schema/cities'

/**
 * Resolve a cityId from a postal code and city name.
 * Looks up by postal code first, then by name as fallback.
 * Returns null if no match is found.
 */
export async function resolveCityId(postalCode: string, cityName: string): Promise<number | null> {
  // 1. Try matching by postal code
  const byPostal = await db.select({ id: cities.id }).from(cities).where(sql`${postalCode} = ANY(${cities.postalCodes})`).limit(1)
  if (byPostal[0]) return byPostal[0].id

  // 2. Fallback: match by city name
  const byName = await db.select({ id: cities.id }).from(cities).where(sql`LOWER(${cities.name}) = LOWER(${cityName})`).limit(1)
  if (byName[0]) return byName[0].id

  return null
}
