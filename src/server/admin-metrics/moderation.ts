import { addMonths, format } from 'date-fns'
import { type AnyColumn, and, eq, gte, isNotNull, lt, sql } from 'drizzle-orm'
import { EReminderType } from '~/enums/reminder-email'
import { monthStart, type TMonth } from '~/server/admin-metrics/months'
import { segmentOwner, type TOwnerSegment } from '~/server/admin-metrics/segment'
import { db } from '~/server/db'
import { accommodations, activityLog, applicationFacts, owners, reminderEmailItems, reminderEmails } from '~/server/db/schema'

export type TOwnerModerationRow = {
  ownerId: number
  ownerName: string
  month: TMonth
  recus: number
  recusBoursiers: number
  aTraiter: number
  traites: number
  jamaisTraites: number
  contactes: number
  delaiMoyenHeures: number | null
  alertes: number
  suspensions: number
  segment: TOwnerSegment
}

const SEGMENT_ORDER: Record<TOwnerSegment, number> = {
  mauvais_eleve: 0,
  irregulier: 1,
  bon_eleve: 2,
  non_concerne: 3,
}

const UNPROCESSED = 'unprocessed_applications'

export const getOwnerModeration = async (month: TMonth): Promise<TOwnerModerationRow[]> => {
  const start = monthStart(month)
  const end = monthStart(format(addMonths(new Date(`${month}-01T00:00:00`), 1), 'yyyy-MM'))
  const startIso = start.toISOString()
  const endIso = end.toISOString()
  const received = and(gte(applicationFacts.createdAt, start), lt(applicationFacts.createdAt, end))
  const inMonth = (column: AnyColumn) => and(gte(column, start), lt(column, end))

  const [factRows, alertRows, suspensionRows, publishedRows] = await Promise.all([
    db
      .select({
        ownerId: applicationFacts.ownerId,
        recus: sql<number>`count(*) filter (where ${received})::int`,
        recusBoursiers: sql<number>`count(*) filter (where ${received} and ${applicationFacts.scholarshipStatus} = 'yes')::int`,
        aTraiter: sql<number>`count(*) filter (where ${applicationFacts.createdAt} < ${endIso}::timestamptz and (${applicationFacts.firstTreatedAt} is null or ${applicationFacts.firstTreatedAt} >= ${startIso}::timestamptz))::int`,
        traites: sql<number>`count(*) filter (where ${inMonth(applicationFacts.firstTreatedAt)})::int`,
        jamaisTraites: sql<number>`count(*) filter (where ${received} and ${applicationFacts.firstTreatedAt} is null)::int`,
        contactes: sql<number>`count(*) filter (where ${received} and ${applicationFacts.contactedAt} is not null)::int`,
        delaiMoyenHeures: sql<
          number | null
        >`avg(extract(epoch from (${applicationFacts.firstTreatedAt} - ${applicationFacts.createdAt})) / 3600) filter (where ${received} and ${applicationFacts.firstTreatedAt} is not null)::float`,
      })
      .from(applicationFacts)
      .where(and(isNotNull(applicationFacts.ownerId), lt(applicationFacts.createdAt, end)))
      .groupBy(applicationFacts.ownerId),
    db
      .select({ ownerId: reminderEmails.ownerId, alertes: sql<number>`count(distinct ${reminderEmails.id})::int` })
      .from(reminderEmails)
      .innerJoin(reminderEmailItems, eq(reminderEmailItems.reminderEmailId, reminderEmails.id))
      .where(
        and(
          eq(reminderEmails.type, EReminderType.APPLICATIONS_INACTIVITY_WARNING),
          eq(reminderEmailItems.reason, UNPROCESSED),
          isNotNull(reminderEmails.ownerId),
          inMonth(reminderEmails.sentAt),
        ),
      )
      .groupBy(reminderEmails.ownerId),
    db
      .select({ ownerId: activityLog.ownerId, suspensions: sql<number>`count(distinct ${activityLog.id})::int` })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.action, 'accommodation.applications_auto_suspended'),
          sql`${activityLog.metadata}->>'reason' = ${UNPROCESSED}`,
          isNotNull(activityLog.ownerId),
          inMonth(activityLog.createdAt),
        ),
      )
      .groupBy(activityLog.ownerId),
    db
      .selectDistinct({ ownerId: accommodations.ownerId })
      .from(accommodations)
      .where(and(eq(accommodations.published, true), isNotNull(accommodations.ownerId))),
  ])

  const facts = new Map(factRows.map((row) => [row.ownerId, row]))
  const alerts = new Map(alertRows.map((row) => [row.ownerId, row.alertes]))
  const suspensions = new Map(suspensionRows.map((row) => [row.ownerId, row.suspensions]))

  const ownerIds = new Set<number>()
  for (const id of [...facts.keys(), ...alerts.keys(), ...suspensions.keys(), ...publishedRows.map((r) => r.ownerId)]) {
    if (id !== null) ownerIds.add(id)
  }
  if (ownerIds.size === 0) return []

  const names = new Map((await db.select({ id: owners.id, name: owners.name }).from(owners)).map((o) => [o.id, o.name]))

  return [...ownerIds]
    .flatMap((ownerId) => {
      const ownerName = names.get(ownerId)
      if (ownerName === undefined) return []
      const f = facts.get(ownerId)
      const counts = {
        aTraiter: f?.aTraiter ?? 0,
        traites: f?.traites ?? 0,
        alertes: alerts.get(ownerId) ?? 0,
        suspensions: suspensions.get(ownerId) ?? 0,
      }
      return [
        {
          ownerId,
          ownerName,
          month,
          recus: f?.recus ?? 0,
          recusBoursiers: f?.recusBoursiers ?? 0,
          ...counts,
          jamaisTraites: f?.jamaisTraites ?? 0,
          contactes: f?.contactes ?? 0,
          delaiMoyenHeures: f?.delaiMoyenHeures ?? null,
          segment: segmentOwner(counts),
        },
      ]
    })
    .sort((x, y) => SEGMENT_ORDER[x.segment] - SEGMENT_ORDER[y.segment] || x.ownerName.localeCompare(y.ownerName, 'fr'))
}
