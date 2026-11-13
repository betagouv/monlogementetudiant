import { and, count, eq, sql } from 'drizzle-orm'
import { INACTIVITY_WARNING_DAYS } from '~/server/bailleur/inactivity-rules'
import { db } from '~/server/db'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { accommodations } from '~/server/db/schema/accommodations'
import { availabilityFollowUpSnapshots } from '~/server/db/schema/availability-snapshots'
import { owners } from '~/server/db/schema/owners'
import { DAY_MS } from '~/utils/time'

const AVAILABILITY_API_SOURCES = ['arpej', 'fac-habitat', 'initiall']

export type OwnerSegment = 'good' | 'irregular' | 'bad'

export type SituationCounts = { residences: number; residencesApi: number; apartments: number; apartmentsApi: number }

export type OwnerFollowUpRow = {
  ownerId: number | null
  ownerName: string
  segment: OwnerSegment
  recent: SituationCounts
  stale: SituationCounts
  missing: SituationCounts
}

// Fragments SQL communs : résidences publiées hors CROUS ; les imports API n'horodatent pas
// les typologies, la date de dernier import (updatedAt) fait foi pour leurs résidences.
function buildFragments() {
  const recentSince = new Date(Date.now() - INACTIVITY_WARNING_DAYS.stale_availability * DAY_MS).toISOString()
  const isCrous = sql`exists (select 1 from external_source where accommodation_id = ${accommodations.id} and source = 'crous')`
  const isApi = sql`exists (select 1 from external_source where accommodation_id = ${accommodations.id} and source in (${sql.join(
    AVAILABILITY_API_SOURCES.map((source) => sql`${source}`),
    sql`, `,
  )}))`
  const hasAvailability = sql`exists (select 1 from ${accommodationTypologies} where ${accommodationTypologies.accommodationId} = ${accommodations.id} and ${accommodationTypologies.nbAvailable} is not null)`
  const lastUpdate = sql`greatest(
    (select max(${accommodationTypologies.availabilityUpdatedAt}) from ${accommodationTypologies} where ${accommodationTypologies.accommodationId} = ${accommodations.id}),
    case when ${isApi} then ${accommodations.updatedAt} end
  )`
  // coalesce : une dispo renseignée mais jamais horodatée (données d'avant le tracking) est « pas récente », pas hors catégorie
  const isRecent = sql`(${hasAvailability} and coalesce(${lastUpdate} >= ${recentSince}::timestamptz, false))`
  const isMissing = sql`(not ${hasAvailability})`
  const isStale = sql`(${hasAvailability} and not coalesce(${lastUpdate} >= ${recentSince}::timestamptz, false))`
  return { isCrous, isApi, isRecent, isMissing, isStale }
}

/** Tableau global du tableau de bord (compte des résidences par situation, part API). */
export async function loadAvailabilityFollowUp() {
  const { isCrous, isApi, isRecent, isMissing, isStale } = buildFragments()

  const [row] = await db
    .select({
      total: count(),
      totalApi: sql<number>`count(*) filter (where ${isApi})`.mapWith(Number),
      recent: sql<number>`count(*) filter (where ${isRecent})`.mapWith(Number),
      recentApi: sql<number>`count(*) filter (where ${isRecent} and ${isApi})`.mapWith(Number),
      nonRenseignee: sql<number>`count(*) filter (where ${isMissing})`.mapWith(Number),
      nonRenseigneeApi: sql<number>`count(*) filter (where ${isMissing} and ${isApi})`.mapWith(Number),
      ancienne: sql<number>`count(*) filter (where ${isStale})`.mapWith(Number),
      ancienneApi: sql<number>`count(*) filter (where ${isStale} and ${isApi})`.mapWith(Number),
    })
    .from(accommodations)
    .where(and(eq(accommodations.published, true), sql`not ${isCrous}`))

  const situation = (value: number, api: number) => ({ count: value, manual: value - api, api })
  return {
    recentDays: INACTIVITY_WARNING_DAYS.stale_availability,
    total: situation(row?.total ?? 0, row?.totalApi ?? 0),
    recent: situation(row?.recent ?? 0, row?.recentApi ?? 0),
    nonRenseignee: situation(row?.nonRenseignee ?? 0, row?.nonRenseigneeApi ?? 0),
    ancienne: situation(row?.ancienne ?? 0, row?.ancienneApi ?? 0),
  }
}

/**
 * Segmentation d'un gestionnaire sur son parc de résidences :
 * bon élève = tout est renseigné et au moins 80 % à jour ; mauvais élève = rien n'a
 * jamais été renseigné ; irrégulier = le reste.
 */
export const GOOD_OWNER_RECENT_SHARE = 0.8

export function segmentOwner(counts: { recent: number; stale: number; missing: number }): OwnerSegment {
  const total = counts.recent + counts.stale + counts.missing
  if (total === 0 || counts.missing === total) return 'bad'
  if (counts.missing === 0 && counts.recent / total >= GOOD_OWNER_RECENT_SHARE) return 'good'
  return 'irregular'
}

/** Détail par gestionnaire : résidences et logements par situation, part API, segment. */
export async function loadAvailabilityByOwner(): Promise<OwnerFollowUpRow[]> {
  const { isCrous, isApi, isRecent, isMissing, isStale } = buildFragments()
  const apartments = sql`coalesce(${accommodations.nbTotalApartments}, 0)`

  const rows = await db
    .select({
      ownerId: accommodations.ownerId,
      ownerName: sql<string | null>`${owners.name}`,
      recentResidences: sql<number>`count(*) filter (where ${isRecent})`.mapWith(Number),
      recentResidencesApi: sql<number>`count(*) filter (where ${isRecent} and ${isApi})`.mapWith(Number),
      recentApartments: sql<number>`coalesce(sum(${apartments}) filter (where ${isRecent}), 0)`.mapWith(Number),
      recentApartmentsApi: sql<number>`coalesce(sum(${apartments}) filter (where ${isRecent} and ${isApi}), 0)`.mapWith(Number),
      staleResidences: sql<number>`count(*) filter (where ${isStale})`.mapWith(Number),
      staleResidencesApi: sql<number>`count(*) filter (where ${isStale} and ${isApi})`.mapWith(Number),
      staleApartments: sql<number>`coalesce(sum(${apartments}) filter (where ${isStale}), 0)`.mapWith(Number),
      staleApartmentsApi: sql<number>`coalesce(sum(${apartments}) filter (where ${isStale} and ${isApi}), 0)`.mapWith(Number),
      missingResidences: sql<number>`count(*) filter (where ${isMissing})`.mapWith(Number),
      missingResidencesApi: sql<number>`count(*) filter (where ${isMissing} and ${isApi})`.mapWith(Number),
      missingApartments: sql<number>`coalesce(sum(${apartments}) filter (where ${isMissing}), 0)`.mapWith(Number),
      missingApartmentsApi: sql<number>`coalesce(sum(${apartments}) filter (where ${isMissing} and ${isApi}), 0)`.mapWith(Number),
    })
    .from(accommodations)
    .leftJoin(owners, eq(owners.id, accommodations.ownerId))
    .where(and(eq(accommodations.published, true), sql`not ${isCrous}`))
    .groupBy(accommodations.ownerId, owners.name)

  return rows
    .map((row) => {
      const recent: SituationCounts = {
        residences: row.recentResidences,
        residencesApi: row.recentResidencesApi,
        apartments: row.recentApartments,
        apartmentsApi: row.recentApartmentsApi,
      }
      const stale: SituationCounts = {
        residences: row.staleResidences,
        residencesApi: row.staleResidencesApi,
        apartments: row.staleApartments,
        apartmentsApi: row.staleApartmentsApi,
      }
      const missing: SituationCounts = {
        residences: row.missingResidences,
        residencesApi: row.missingResidencesApi,
        apartments: row.missingApartments,
        apartmentsApi: row.missingApartmentsApi,
      }
      return {
        ownerId: row.ownerId,
        ownerName: row.ownerName ?? 'Sans gestionnaire',
        segment: segmentOwner({ recent: recent.residences, stale: stale.residences, missing: missing.residences }),
        recent,
        stale,
        missing,
      }
    })
    .sort(
      (a, b) =>
        b.recent.apartments + b.stale.apartments + b.missing.apartments - (a.recent.apartments + a.stale.apartments + a.missing.apartments),
    )
}

/** Fige le relevé du jour (une ligne par gestionnaire) ; rejouable le même jour sans doublon. */
export async function captureAvailabilitySnapshot(now = new Date()) {
  const capturedOn = now.toISOString().slice(0, 10)
  const rows = await loadAvailabilityByOwner()

  await db.transaction(async (tx) => {
    await tx.delete(availabilityFollowUpSnapshots).where(eq(availabilityFollowUpSnapshots.capturedOn, capturedOn))
    if (rows.length === 0) return
    await tx.insert(availabilityFollowUpSnapshots).values(
      rows.map((row) => ({
        capturedOn,
        ownerId: row.ownerId,
        recentResidences: row.recent.residences,
        recentResidencesApi: row.recent.residencesApi,
        recentApartments: row.recent.apartments,
        recentApartmentsApi: row.recent.apartmentsApi,
        staleResidences: row.stale.residences,
        staleResidencesApi: row.stale.residencesApi,
        staleApartments: row.stale.apartments,
        staleApartmentsApi: row.stale.apartmentsApi,
        missingResidences: row.missing.residences,
        missingResidencesApi: row.missing.residencesApi,
        missingApartments: row.missing.apartments,
        missingApartmentsApi: row.missing.apartmentsApi,
      })),
    )
  })

  return { capturedOn, owners: rows.length }
}

/** Série mensuelle agrégée (tous gestionnaires confondus) pour la courbe de progression. */
export async function loadAvailabilitySnapshotSeries() {
  return db
    .select({
      capturedOn: availabilityFollowUpSnapshots.capturedOn,
      recentApartments: sql<number>`sum(${availabilityFollowUpSnapshots.recentApartments})`.mapWith(Number),
      staleApartments: sql<number>`sum(${availabilityFollowUpSnapshots.staleApartments})`.mapWith(Number),
      missingApartments: sql<number>`sum(${availabilityFollowUpSnapshots.missingApartments})`.mapWith(Number),
      recentResidences: sql<number>`sum(${availabilityFollowUpSnapshots.recentResidences})`.mapWith(Number),
      staleResidences: sql<number>`sum(${availabilityFollowUpSnapshots.staleResidences})`.mapWith(Number),
      missingResidences: sql<number>`sum(${availabilityFollowUpSnapshots.missingResidences})`.mapWith(Number),
    })
    .from(availabilityFollowUpSnapshots)
    .groupBy(availabilityFollowUpSnapshots.capturedOn)
    .orderBy(availabilityFollowUpSnapshots.capturedOn)
}
