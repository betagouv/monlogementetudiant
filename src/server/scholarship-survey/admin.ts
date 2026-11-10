import { and, asc, count, countDistinct, eq, ilike, isNotNull, isNull, or, type SQL } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { user } from '~/server/db/schema/auth'
import { cities } from '~/server/db/schema/cities'
import { owners } from '~/server/db/schema/owners'
import { scholarshipSurveyAnswers, scholarshipSurveyOwners } from '~/server/db/schema/scholarship-survey'
import { eligibleResidenceCondition } from './service'

export const SURVEY_STATUS_FILTERS = ['all', 'answered', 'unanswered'] as const
export type SurveyStatusFilter = (typeof SURVEY_STATUS_FILTERS)[number]

export type SurveyAdminRow = {
  accommodationId: number
  accommodationName: string
  city: string | null
  ownerId: number
  ownerName: string
  scholarshipCount: number | null
  scholarshipRate: number | null
  notMeasured: boolean | null
  updatedAt: Date | null
  updatedBy: string | null
  ownerCompletedAt: Date | null
}

const ADMIN_PAGE_SIZE = 20

const statusCondition = (status: SurveyStatusFilter): SQL | undefined => {
  if (status === 'answered') return isNotNull(scholarshipSurveyAnswers.id)
  if (status === 'unanswered') return isNull(scholarshipSurveyAnswers.id)
  return undefined
}

const searchCondition = (search?: string): SQL | undefined => {
  const term = search?.trim()
  if (!term) return undefined
  return or(ilike(accommodations.name, `%${term}%`), ilike(owners.name, `%${term}%`))
}

export async function listSurveyRows(params: {
  status: SurveyStatusFilter
  search?: string
  page?: number
}): Promise<{ rows: SurveyAdminRow[]; total: number; pageCount: number }> {
  const where = and(eligibleResidenceCondition(), statusCondition(params.status), searchCondition(params.search))

  const [countRow] = await db
    .select({ total: count() })
    .from(accommodations)
    .innerJoin(owners, eq(owners.id, accommodations.ownerId))
    .leftJoin(scholarshipSurveyAnswers, eq(scholarshipSurveyAnswers.accommodationId, accommodations.id))
    .where(where)
  const total = countRow?.total ?? 0

  const query = db
    .select({
      accommodationId: accommodations.id,
      accommodationName: accommodations.name,
      city: cities.name,
      ownerId: owners.id,
      ownerName: owners.name,
      scholarshipCount: scholarshipSurveyAnswers.scholarshipCount,
      scholarshipRate: scholarshipSurveyAnswers.scholarshipRate,
      notMeasured: scholarshipSurveyAnswers.notMeasured,
      updatedAt: scholarshipSurveyAnswers.updatedAt,
      updatedBy: user.email,
      ownerCompletedAt: scholarshipSurveyOwners.completedAt,
    })
    .from(accommodations)
    .innerJoin(owners, eq(owners.id, accommodations.ownerId))
    .leftJoin(scholarshipSurveyAnswers, eq(scholarshipSurveyAnswers.accommodationId, accommodations.id))
    .leftJoin(
      accommodationAddresses,
      and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true)),
    )
    .leftJoin(cities, eq(cities.id, accommodationAddresses.cityId))
    .leftJoin(user, eq(user.id, scholarshipSurveyAnswers.updatedByUserId))
    .leftJoin(scholarshipSurveyOwners, eq(scholarshipSurveyOwners.ownerId, owners.id))
    .where(where)
    .orderBy(asc(owners.name), asc(accommodations.name), asc(accommodations.id))
    .$dynamic()

  const rows = params.page ? await query.limit(ADMIN_PAGE_SIZE).offset((params.page - 1) * ADMIN_PAGE_SIZE) : await query

  return { rows, total, pageCount: Math.ceil(total / ADMIN_PAGE_SIZE) }
}

export async function getSurveyStats(): Promise<{
  ownersCompleted: number
  ownersTotal: number
  residencesFilled: number
  residencesTotal: number
}> {
  const [row] = await db
    .select({
      ownersTotal: countDistinct(owners.id),
      ownersCompleted: countDistinct(scholarshipSurveyOwners.ownerId),
      residencesTotal: count(accommodations.id),
      residencesFilled: count(scholarshipSurveyAnswers.id),
    })
    .from(accommodations)
    .innerJoin(owners, eq(owners.id, accommodations.ownerId))
    .leftJoin(scholarshipSurveyAnswers, eq(scholarshipSurveyAnswers.accommodationId, accommodations.id))
    .leftJoin(scholarshipSurveyOwners, eq(scholarshipSurveyOwners.ownerId, owners.id))
    .where(eligibleResidenceCondition())

  return {
    ownersCompleted: row?.ownersCompleted ?? 0,
    ownersTotal: row?.ownersTotal ?? 0,
    residencesFilled: row?.residencesFilled ?? 0,
    residencesTotal: row?.residencesTotal ?? 0,
  }
}
