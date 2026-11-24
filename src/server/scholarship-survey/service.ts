import { TRPCError } from '@trpc/server'
import { and, asc, eq, inArray, not } from 'drizzle-orm'
import { isAnswerFilled, type TScholarshipSurveyAnswer } from '~/schemas/scholarship-survey'
import { crousExistsCondition } from '~/server/accommodations/list-query'
import { type AccommodationScope, scopeAccommodationIdCondition } from '~/server/bailleur/accommodation-scope'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { scholarshipSurveyAnswers, scholarshipSurveyOwners } from '~/server/db/schema/scholarship-survey'
import { isScholarshipSurveyActive } from './active'

export type SurveyResidence = { id: number; name: string; answer: TScholarshipSurveyAnswer | null }

type SurveyWriteParams = { ownerId: number; scope: AccommodationScope; userId: string; answers: TScholarshipSurveyAnswer[] }

const ALL: AccommodationScope = { kind: 'all' }

export const eligibleResidenceCondition = () => and(eq(accommodations.published, true), not(crousExistsCondition))

export async function getSurveyResidences(ownerId: number, scope: AccommodationScope): Promise<SurveyResidence[]> {
  const rows = await db
    .select({
      id: accommodations.id,
      name: accommodations.name,
      scholarshipCount: scholarshipSurveyAnswers.scholarshipCount,
      scholarshipRate: scholarshipSurveyAnswers.scholarshipRate,
      notMeasured: scholarshipSurveyAnswers.notMeasured,
    })
    .from(accommodations)
    .leftJoin(scholarshipSurveyAnswers, eq(scholarshipSurveyAnswers.accommodationId, accommodations.id))
    .where(and(eq(accommodations.ownerId, ownerId), eligibleResidenceCondition(), scopeAccommodationIdCondition(scope)))
    .orderBy(asc(accommodations.name), asc(accommodations.id))

  return rows.map(({ id, name, scholarshipCount, scholarshipRate, notMeasured }) => ({
    id,
    name,
    answer: notMeasured === null ? null : { accommodationId: id, scholarshipCount, scholarshipRate, notMeasured },
  }))
}

export async function saveSurveyAnswers({ ownerId, scope, userId, answers }: SurveyWriteParams): Promise<void> {
  if (answers.length === 0) return
  const allowed = new Set((await getSurveyResidences(ownerId, scope)).map((r) => r.id))
  if (answers.some((a) => !allowed.has(a.accommodationId))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Résidence hors du périmètre de l’enquête' })
  }

  const filled = answers.filter(isAnswerFilled)
  const cleared = answers.filter((a) => !isAnswerFilled(a)).map((a) => a.accommodationId)

  await db.transaction(async (tx) => {
    if (cleared.length > 0) {
      await tx.delete(scholarshipSurveyAnswers).where(inArray(scholarshipSurveyAnswers.accommodationId, cleared))
    }
    for (const a of filled) {
      const values = {
        scholarshipCount: a.scholarshipCount,
        scholarshipRate: a.scholarshipRate,
        notMeasured: a.notMeasured,
        updatedByUserId: userId,
      }
      await tx
        .insert(scholarshipSurveyAnswers)
        .values({ accommodationId: a.accommodationId, ...values })
        .onConflictDoUpdate({ target: scholarshipSurveyAnswers.accommodationId, set: { ...values, updatedAt: new Date() } })
    }
  })
}

const missingResidences = (residences: SurveyResidence[]) =>
  residences.filter((r) => !r.answer || !isAnswerFilled(r.answer)).map(({ id, name }) => ({ id, name }))

export async function submitSurveyAnswers(
  params: SurveyWriteParams,
): Promise<{ missing: { id: number; name: string }[]; ownerCompleted: boolean }> {
  await saveSurveyAnswers(params)
  const missing = missingResidences(await getSurveyResidences(params.ownerId, params.scope))
  const ownerResidences = await getSurveyResidences(params.ownerId, ALL)
  const ownerFilled = ownerResidences.length > 0 && missingResidences(ownerResidences).length === 0

  if (ownerFilled) {
    await db
      .insert(scholarshipSurveyOwners)
      .values({ ownerId: params.ownerId, completedByUserId: params.userId })
      .onConflictDoNothing({ target: scholarshipSurveyOwners.ownerId })
  }

  return { missing, ownerCompleted: ownerFilled || (await isOwnerSurveyCompleted(params.ownerId)) }
}

export async function isOwnerSurveyCompleted(ownerId: number): Promise<boolean> {
  const row = await db.query.scholarshipSurveyOwners.findFirst({
    where: eq(scholarshipSurveyOwners.ownerId, ownerId),
    columns: { id: true },
  })
  return !!row
}

export async function isSurveyPendingForUser(ownerId: number, scope: AccommodationScope): Promise<boolean> {
  if (!isScholarshipSurveyActive()) return false
  if (await isOwnerSurveyCompleted(ownerId)) return false
  return missingResidences(await getSurveyResidences(ownerId, scope)).length > 0
}
