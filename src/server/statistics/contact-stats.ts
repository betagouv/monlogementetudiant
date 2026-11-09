import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { EContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { type AccommodationScope, scopeAccommodationIdCondition } from '~/server/bailleur/accommodation-scope'
import { confirmedContactRequest, verifiedDossierFacileTenant } from '~/server/candidatures/visibility'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { contactRequests } from '~/server/db/schema/contacts'
import { dossierFacileApplications, dossierFacileTenants } from '~/server/db/schema/dossier-facile'
import { getDateRange, type TStatisticsPeriod } from '~/server/statistics/accommodation-stats'

export type TContactStatsCounts = {
  received: number
  nonModere: number
  nonRetenu: number
  contacte: number
  logementAttribue: number
}

export type TContactStatsRow = TContactStatsCounts & {
  accommodationId: number
  residence: string
  city: string | null
}

type ListContactStatsParams = {
  ownerId: number
  contactMode: EOwnerContactMode.CONTACTS | EOwnerContactMode.DOSSIER_FACILE
  scope: AccommodationScope
  period: TStatisticsPeriod
}

const ZERO_COUNTS: TContactStatsCounts = { received: 0, nonModere: 0, nonRetenu: 0, contacte: 0, logementAttribue: 0 }

export const emptyContactStats = (): TContactStatsCounts => ({ ...ZERO_COUNTS })

const statusCount = (status: PgColumn, ...statuses: EContactStatus[]) =>
  sql<number>`(count(*) filter (where ${status} in (${sql.join(
    statuses.map((s) => sql`${s}`),
    sql`, `,
  )})))::int`

const countSelect = (status: PgColumn) => ({
  received: sql<number>`count(*)::int`,
  nonModere: statusCount(status, EContactStatus.A_MODERER, EContactStatus.A_CONTACTER),
  nonRetenu: statusCount(status, EContactStatus.NON_RETENU),
  contacte: statusCount(status, EContactStatus.CONTACTE),
  logementAttribue: statusCount(status, EContactStatus.LOGEMENT_ATTRIBUE),
})

const sumCounts = (rows: TContactStatsCounts[]): TContactStatsCounts =>
  rows.reduce(
    (acc, r) => ({
      received: acc.received + r.received,
      nonModere: acc.nonModere + r.nonModere,
      nonRetenu: acc.nonRetenu + r.nonRetenu,
      contacte: acc.contacte + r.contacte,
      logementAttribue: acc.logementAttribue + r.logementAttribue,
    }),
    emptyContactStats(),
  )

export async function listContactStats({ ownerId, contactMode, scope, period }: ListContactStatsParams) {
  const { from, to } = getDateRange(period)

  const residences = await db
    .select({
      id: accommodations.id,
      slug: accommodations.slug,
      name: accommodations.name,
      city: cities.name,
      acceptsApplications: accommodations.acceptsApplications,
    })
    .from(accommodations)
    .leftJoin(
      accommodationAddresses,
      and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
    )
    .leftJoin(cities, eq(accommodationAddresses.cityId, cities.id))
    .where(and(eq(accommodations.ownerId, ownerId), scopeAccommodationIdCondition(scope)))
    .orderBy(asc(accommodations.name))

  const countsById = new Map<number, TContactStatsCounts>()

  if (residences.length > 0 && contactMode === EOwnerContactMode.CONTACTS) {
    const counts = await db
      .select({ accommodationId: contactRequests.accommodationId, ...countSelect(contactRequests.status) })
      .from(contactRequests)
      .where(
        and(
          inArray(
            contactRequests.accommodationId,
            residences.map((r) => r.id),
          ),
          gte(contactRequests.createdAt, from),
          confirmedContactRequest(),
        ),
      )
      .groupBy(contactRequests.accommodationId)
    for (const { accommodationId, ...c } of counts) countsById.set(accommodationId, c)
  } else if (residences.length > 0) {
    const counts = await db
      .select({ accommodationId: accommodations.id, ...countSelect(dossierFacileApplications.status) })
      .from(dossierFacileApplications)
      .innerJoin(dossierFacileTenants, eq(dossierFacileApplications.tenantId, dossierFacileTenants.id))
      .innerJoin(accommodations, eq(dossierFacileApplications.accommodationSlug, accommodations.slug))
      .where(
        and(
          inArray(
            accommodations.id,
            residences.map((r) => r.id),
          ),
          gte(dossierFacileApplications.createdAt, from),
          verifiedDossierFacileTenant(),
        ),
      )
      .groupBy(accommodations.id)
    for (const { accommodationId, ...c } of counts) countsById.set(accommodationId, c)
  }

  const rows: TContactStatsRow[] = residences
    .map((r) => ({
      accommodationId: r.id,
      residence: r.name,
      city: r.city,
      acceptsApplications: r.acceptsApplications,
      ...(countsById.get(r.id) ?? emptyContactStats()),
    }))
    .filter((r) => r.acceptsApplications || r.received > 0)
    .map(({ acceptsApplications: _, ...r }) => r)

  return { rows, total: sumCounts(rows), from, to }
}
