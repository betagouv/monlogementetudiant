import { and, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm'
import type { InactivityReason } from '~/server/bailleur/inactivity-rules'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { activityLog } from '~/server/db/schema/activity-log'
import { contactRequests } from '~/server/db/schema/contacts'
import { dossierFacileApplications } from '~/server/db/schema/dossier-facile'
import { reminderEmailItems, reminderEmails } from '~/server/db/schema/reminder-emails'
import { decideEfficacy, type TItemFacts, type TReminderEfficacyStatus } from './reminder-efficacy'

type TEfficacy = { status: TReminderEfficacyStatus; reactionMs: number | null; residencesCount: number }

type TEvent = { key: string; at: Date }

const RESOLVING_ACTIONS = ['accommodation.availability_updated', 'accommodation.availability_confirmed']
const SUSPENSION_ACTION = 'accommodation.applications_auto_suspended'
const FAILING_STALE_ACTIONS = ['accommodation.availability_auto_reset', SUSPENSION_ACTION]

const logKey = (ownerId: number | null, slug: string | null) => `${ownerId}:${slug}`

const firstAfter = (events: TEvent[] | undefined, sentAt: Date): Date | null => {
  let first: Date | null = null
  for (const event of events ?? []) {
    if (event.at.getTime() > sentAt.getTime() && (first === null || event.at.getTime() < first.getTime())) first = event.at
  }
  return first
}

const groupByKey = (events: TEvent[]) => {
  const grouped = new Map<string, TEvent[]>()
  for (const event of events) grouped.set(event.key, [...(grouped.get(event.key) ?? []), event])
  return grouped
}

export async function loadReminderEfficacy(messageIds: string[], now = new Date()): Promise<Map<string, TEfficacy>> {
  const result = new Map<string, TEfficacy>()
  if (messageIds.length === 0) return result

  const emails = await db.select().from(reminderEmails).where(inArray(reminderEmails.messageId, messageIds))
  if (emails.length === 0) return result

  const rows = await db
    .select({
      reminderEmailId: reminderEmailItems.reminderEmailId,
      accommodationId: reminderEmailItems.accommodationId,
      reason: reminderEmailItems.reason,
      slug: accommodations.slug,
    })
    .from(reminderEmailItems)
    .innerJoin(accommodations, eq(accommodations.id, reminderEmailItems.accommodationId))
    .where(
      inArray(
        reminderEmailItems.reminderEmailId,
        emails.map((email) => email.id),
      ),
    )

  const minSentAt = new Date(Math.min(...emails.map((email) => email.sentAt.getTime())))
  const slugs = [...new Set(rows.map((row) => row.slug))]
  const accommodationIds = [...new Set(rows.map((row) => row.accommodationId))]

  const loadLogs = async (actions: string[]) => {
    if (slugs.length === 0) return new Map<string, TEvent[]>()
    const logs = await db
      .select({ ownerId: activityLog.ownerId, slug: sql<string>`${activityLog.metadata}->>'slug'`, createdAt: activityLog.createdAt })
      .from(activityLog)
      .where(
        and(
          inArray(activityLog.action, actions),
          gt(activityLog.createdAt, minSentAt),
          inArray(sql`${activityLog.metadata}->>'slug'`, slugs),
        ),
      )
    return groupByKey(logs.map((log) => ({ key: logKey(log.ownerId, log.slug), at: log.createdAt })))
  }

  const [resolvingLogs, staleFailingLogs, suspensionLogs, contactReviews, dossierReviews] = await Promise.all([
    loadLogs(RESOLVING_ACTIONS),
    loadLogs(FAILING_STALE_ACTIONS),
    loadLogs([SUSPENSION_ACTION]),
    db
      .select({ id: contactRequests.accommodationId, reviewedAt: contactRequests.reviewedAt })
      .from(contactRequests)
      .where(
        and(
          inArray(contactRequests.accommodationId, accommodationIds),
          isNotNull(contactRequests.reviewedAt),
          gt(contactRequests.reviewedAt, minSentAt),
        ),
      ),
    db
      .select({ slug: dossierFacileApplications.accommodationSlug, reviewedAt: dossierFacileApplications.reviewedAt })
      .from(dossierFacileApplications)
      .where(
        and(
          inArray(dossierFacileApplications.accommodationSlug, slugs),
          isNotNull(dossierFacileApplications.reviewedAt),
          gt(dossierFacileApplications.reviewedAt, minSentAt),
        ),
      ),
  ])

  const contactsByAccommodation = groupByKey(
    contactReviews.flatMap((row) => (row.reviewedAt ? [{ key: String(row.id), at: row.reviewedAt }] : [])),
  )
  const dossiersBySlug = groupByKey(dossierReviews.flatMap((row) => (row.reviewedAt ? [{ key: row.slug, at: row.reviewedAt }] : [])))

  const earliest = (...dates: (Date | null)[]) => {
    const present = dates.filter((date): date is Date => date !== null)
    return present.length === 0 ? null : new Date(Math.min(...present.map((date) => date.getTime())))
  }

  const factsFor = (reason: InactivityReason, slug: string, accommodationId: number, ownerId: number | null, sentAt: Date): TItemFacts => {
    const key = logKey(ownerId, slug)
    if (reason === 'stale_availability') {
      return { resolvedAt: firstAfter(resolvingLogs.get(key), sentAt), failedAt: firstAfter(staleFailingLogs.get(key), sentAt) }
    }
    return {
      resolvedAt: earliest(
        firstAfter(contactsByAccommodation.get(String(accommodationId)), sentAt),
        firstAfter(dossiersBySlug.get(slug), sentAt),
      ),
      failedAt: firstAfter(suspensionLogs.get(key), sentAt),
    }
  }

  for (const email of emails) {
    const items = rows
      .filter((row) => row.reminderEmailId === email.id)
      .map((row) => factsFor(row.reason, row.slug, row.accommodationId, email.ownerId, email.sentAt))
    const { status, reactionMs } = decideEfficacy({ type: email.type, sentAt: email.sentAt, items, now })
    result.set(email.messageId, { status, reactionMs, residencesCount: items.length })
  }
  return result
}
