import { sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { cities } from '~/server/db/schema/cities'

/**
 * Resolve a cityId from a postal code and city name.
 * Looks up by postal code first, then by name as fallback.
 * Returns null if no match is found.
 */
export async function resolveCityId(postalCode: string, cityName: string): Promise<number | null> {
  // 1. Try matching by postal code AND city name
  const byBoth = await db
    .select({ id: cities.id })
    .from(cities)
    .where(
      sql`${cities.postalCodes} @> ARRAY[${postalCode}]::varchar[] AND lower(immutable_unaccent(${cities.name})) = lower(immutable_unaccent(${cityName}))`,
    )
    .limit(1)
  if (byBoth[0]) return byBoth[0].id

  // 2. Fallback: match by postal code only.
  // Un code postal couvre souvent plusieurs communes (91400 = Gometz-la-Ville,
  // Orsay, Saclay) : sans tri, Postgres en renverrait une arbitraire. On retient la
  // plus peuplée, qui est la commune principale du code postal.
  const byPostal = await db
    .select({ id: cities.id })
    .from(cities)
    .where(sql`${cities.postalCodes} @> ARRAY[${postalCode}]::varchar[]`)
    .orderBy(sql`${cities.population} DESC NULLS LAST`, cities.id)
    .limit(1)
  if (byPostal[0]) return byPostal[0].id

  // 3. Fallback: match by city name only
  const byName = await db
    .select({ id: cities.id })
    .from(cities)
    .where(sql`lower(immutable_unaccent(${cities.name})) = lower(immutable_unaccent(${cityName}))`)
    .orderBy(sql`${cities.population} DESC NULLS LAST`, cities.id)
    .limit(1)
  if (byName[0]) return byName[0].id

  return null
}
