import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '~/server/db'
import { DAY_MS } from '~/utils/time'

export const ZStatisticsPeriod = z.enum(['7d', '30d', '90d'])

export type TStatisticsPeriod = z.infer<typeof ZStatisticsPeriod>

export const TYPE_VIEWED = 'accommodation.viewed'
export const TYPE_CONSULT_OFFER = 'accommodation.consult_offer'

export function periodToDays(period: TStatisticsPeriod): number {
  return period === '7d' ? 7 : period === '30d' ? 30 : 90
}

export function getDateRange(period: TStatisticsPeriod): { from: Date; to: Date; days: number } {
  const days = periodToDays(period)
  const to = new Date()
  const from = new Date(to.getTime() - days * DAY_MS)
  return { from, to, days }
}

export function getPreviousDateRange(period: TStatisticsPeriod): { from: Date; to: Date } {
  const days = periodToDays(period)
  const to = new Date(Date.now() - days * DAY_MS)
  const from = new Date(to.getTime() - days * DAY_MS)
  return { from, to }
}

export type TAccommodationStatsRow = {
  accommodationId: number
  name: string
  slug: string
  published: boolean
  postalCode: string | null
  cityName: string | null
  nbViews: number
  nbConsultOffer: number
  nbFavorites: number
}

type ListAccommodationStatsParams = {
  ownerId: number
  period: TStatisticsPeriod
  search?: string
  sort?: 'views_desc' | 'views_asc'
  /** Omis, la requête renvoie toutes les résidences du gestionnaire (export CSV). */
  limit?: number
  offset?: number
}

/**
 * Statistiques d'engagement par résidence sur une période.
 *
 * Partagée entre l'affichage paginé du tableau de bord et l'extraction CSV, pour que le fichier
 * téléchargé ne puisse pas diverger de ce que le gestionnaire voit à l'écran.
 */
export async function listAccommodationStats({
  ownerId,
  period,
  search = '',
  sort = 'views_desc',
  limit,
  offset = 0,
}: ListAccommodationStatsParams): Promise<TAccommodationStatsRow[]> {
  const { from, to } = getDateRange(period)
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  const trimmedSearch = search.trim()
  const searchSql = trimmedSearch ? sql`AND immutable_unaccent(a.name) ILIKE immutable_unaccent(${`%${trimmedSearch}%`})` : sql``
  const orderBy = sort === 'views_asc' ? sql`ORDER BY "nbViews" ASC, a.name ASC` : sql`ORDER BY "nbViews" DESC, a.name ASC`
  const pagination = limit === undefined ? sql`` : sql`LIMIT ${limit} OFFSET ${offset}`

  const rows = await db.execute<TAccommodationStatsRow>(sql`
    SELECT
      a.id::int AS "accommodationId",
      a.name AS "name",
      a.slug AS "slug",
      a.published AS "published",
      addr.postal_code AS "postalCode",
      c.name AS "cityName",
      (
        SELECT count(*)::int FROM tracking_event te
        WHERE te.accommodation_id = a.id
          AND te.type = ${TYPE_VIEWED}
          AND te.created_at BETWEEN ${fromIso}::timestamptz AND ${toIso}::timestamptz
      ) AS "nbViews",
      (
        SELECT count(*)::int FROM tracking_event te
        WHERE te.accommodation_id = a.id
          AND te.type = ${TYPE_CONSULT_OFFER}
          AND te.created_at BETWEEN ${fromIso}::timestamptz AND ${toIso}::timestamptz
      ) AS "nbConsultOffer",
      (
        SELECT count(*)::int FROM favorite_accommodation fa
        WHERE fa.accommodation_id = a.id
          AND fa.created_at BETWEEN ${fromIso}::timestamptz AND ${toIso}::timestamptz
      ) AS "nbFavorites"
    FROM accommodation a
    LEFT JOIN accommodation_address addr
      ON addr.accommodation_id = a.id AND addr.is_main = true
    LEFT JOIN city c ON c.id = addr.city_id
    WHERE a.owner_id = ${ownerId}
    ${searchSql}
    ${orderBy}
    ${pagination}
  `)

  return [...rows]
}
