import { and, desc, eq, gt, sql } from 'drizzle-orm'
import { EMonthlyMetric } from '~/enums/monthly-metric'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import type { TMonthRange } from '~/schemas/admin-metrics/month-range'
import { crousExistsCondition } from '~/server/accommodations/list-query'
import { listMonths, share, type TMonth } from '~/server/admin-metrics/months'
import { snapshotsOf } from '~/server/admin-metrics/series'
import { db } from '~/server/db'
import { accommodations, owners } from '~/server/db/schema'

export const CONTACT_PATH_TARGET = 0.2

export type TContactPathMonth = {
  month: TMonth
  logementsPublies: number | null
  logementsActives: number | null
  part: number | null
  residencesSansTotal: number | null
  gestionnairesActives: number | null
  gestionnairesAvecDispo: number | null
}

export type TOwnerToTarget = {
  ownerId: number
  ownerName: string
  residencesAvecDispo: number
  logementsDisponibles: number
  contactMode: EOwnerContactMode.NONE
}

export const getContactPathSeries = async (range: TMonthRange): Promise<TContactPathMonth[]> => {
  const [published, activated, nullTotal, ownersActivated, ownersWithAvailability] = await Promise.all(
    [
      EMonthlyMetric.APARTMENTS_PUBLISHED_HORS_CROUS,
      EMonthlyMetric.APARTMENTS_CONTACT_ACTIVATED_HORS_CROUS,
      EMonthlyMetric.RESIDENCES_NULL_TOTAL_HORS_CROUS,
      EMonthlyMetric.OWNERS_CONTACT_ACTIVATED,
      EMonthlyMetric.OWNERS_WITH_AVAILABILITY,
    ].map(async (metric) => new Map((await snapshotsOf(metric, range)).map((row) => [row.month, row.total]))),
  )

  return listMonths(range).map((month) => {
    const logementsPublies = published.get(month) ?? null
    const logementsActives = activated.get(month) ?? null
    return {
      month,
      logementsPublies,
      logementsActives,
      part: share(logementsActives, logementsPublies),
      residencesSansTotal: nullTotal.get(month) ?? null,
      gestionnairesActives: ownersActivated.get(month) ?? null,
      gestionnairesAvecDispo: ownersWithAvailability.get(month) ?? null,
    }
  })
}

export const getOwnersToTarget = async (): Promise<TOwnerToTarget[]> => {
  const logementsDisponibles = sql<number>`sum(${accommodations.nbAvailableApartments})::int`
  const rows = await db
    .select({
      ownerId: owners.id,
      ownerName: owners.name,
      residencesAvecDispo: sql<number>`count(*)::int`,
      logementsDisponibles,
    })
    .from(owners)
    .innerJoin(accommodations, eq(accommodations.ownerId, owners.id))
    .where(
      and(
        eq(owners.contactMode, EOwnerContactMode.NONE),
        eq(accommodations.published, true),
        gt(accommodations.nbAvailableApartments, 0),
        sql`not ${crousExistsCondition}`,
      ),
    )
    .groupBy(owners.id, owners.name)
    .orderBy(desc(logementsDisponibles), owners.name)
  return rows.map((row) => ({ ...row, contactMode: EOwnerContactMode.NONE }))
}
