import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import { notFound, permanentRedirect } from 'next/navigation'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { getQueryClient, trpc } from '~/server/trpc/server'

const findCitySlugOfHiddenAccommodation = async (slug: string) => {
  const [row] = await db
    .select({ citySlug: cities.slug })
    .from(accommodations)
    .innerJoin(
      accommodationAddresses,
      and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
    )
    .innerJoin(cities, eq(cities.id, accommodationAddresses.cityId))
    .where(eq(accommodations.slug, slug))
    .limit(1)
  return row?.citySlug ?? null
}

export const getAccommodationById = async (slug: string) => {
  try {
    return await getQueryClient().fetchQuery(trpc.accommodations.getBySlug.queryOptions({ slug }))
  } catch (err) {
    if (!(err instanceof TRPCError && err.code === 'NOT_FOUND')) throw err
    const citySlug = await findCitySlugOfHiddenAccommodation(slug)
    if (citySlug) permanentRedirect(`/trouver-un-logement-etudiant/ville/${citySlug}`)
    notFound()
  }
}
