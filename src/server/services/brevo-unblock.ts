import * as Sentry from '@sentry/nextjs'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { user } from '~/server/db/schema/auth'
import { brevoBlockedContacts, brevoUnblockEvents } from '~/server/db/schema/brevo-unblock'
import { env } from '~/server/env'
import { fetchBlockedContacts, type TBlockedReason } from '~/server/services/brevo-reminders'

export const UNBLOCKABLE_REASONS: readonly TBlockedReason[] = ['unsubscribedViaEmail', 'unsubscribedViaMA', 'unsubscribedViaApi']

type TUnblockTrigger = (typeof brevoUnblockEvents.$inferInsert)['trigger']
type TBlockedRow = typeof brevoBlockedContacts.$inferSelect

const UNBLOCK_TIMEOUT_MS = 3000

const isUnblockable = (reason: string | null) => UNBLOCKABLE_REASONS.some((r) => r === reason)

const isProduction = () => env.NEXT_PUBLIC_APP_ENV === 'production'

export const deleteBrevoBlockedContact = async (email: string): Promise<void> => {
  const response = await fetch(`${env.BREVO_BLOCKED_CONTACTS_API_URL}/${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: { 'api-key': env.BREVO_API_KEY, accept: 'application/json' },
    signal: AbortSignal.timeout(UNBLOCK_TIMEOUT_MS),
  })
  if (response.status === 204 || response.status === 404) return
  throw new Error(`Brevo unblock failed: ${response.status}`)
}

const unblock = async (row: TBlockedRow, trigger: TUnblockTrigger): Promise<boolean> => {
  const event = { email: row.email, userId: row.userId, reason: row.reason, blockedAt: row.blockedAt, trigger }
  try {
    await deleteBrevoBlockedContact(row.email)
  } catch (error) {
    Sentry.captureException(error, { tags: { task: 'brevo-unblock' } })
    await db.insert(brevoUnblockEvents).values({
      ...event,
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
  await db.insert(brevoUnblockEvents).values({ ...event, status: 'success' })
  await db.delete(brevoBlockedContacts).where(eq(brevoBlockedContacts.email, row.email))
  return true
}

export const syncAndUnblockManagers = async (): Promise<{ blocked: number; unblocked: number; errors: number }> => {
  if (!isProduction()) return { blocked: 0, unblocked: 0, errors: 0 }

  const contacts = await fetchBlockedContacts()
  const emails = [...new Set(contacts.map((c) => c.email))]

  const owners =
    emails.length === 0
      ? []
      : await db
          .select({ id: user.id, email: sql<string>`lower(${user.email})` })
          .from(user)
          .where(and(eq(user.role, 'owner'), inArray(sql`lower(${user.email})`, emails)))
  const userIdByEmail = new Map(owners.map((o) => [o.email, o.id]))

  const syncedAt = new Date()
  const rows: TBlockedRow[] = []
  const seen = new Set<string>()
  for (const contact of contacts) {
    const userId = userIdByEmail.get(contact.email)
    if (!userId || seen.has(contact.email)) continue
    seen.add(contact.email)
    rows.push({ email: contact.email, userId, reason: contact.reason, blockedAt: contact.blockedAt, syncedAt })
  }

  await db.transaction(async (tx) => {
    await tx.delete(brevoBlockedContacts)
    if (rows.length > 0) await tx.insert(brevoBlockedContacts).values(rows)
  })

  let unblocked = 0
  let errors = 0
  for (const row of rows.filter((r) => isUnblockable(r.reason))) {
    try {
      if (await unblock(row, 'scheduled')) unblocked++
      else errors++
    } catch (error) {
      Sentry.captureException(error, { tags: { task: 'brevo-unblock' } })
      errors++
    }
  }
  return { blocked: rows.length, unblocked, errors }
}

export const unblockOwnerOnLogin = async (email: string): Promise<void> => {
  if (!isProduction()) return
  try {
    const [row] = await db.select().from(brevoBlockedContacts).where(eq(brevoBlockedContacts.email, email.trim().toLowerCase())).limit(1)
    if (!row || !isUnblockable(row.reason)) return
    await unblock(row, 'login')
  } catch (error) {
    Sentry.captureException(error, { tags: { task: 'brevo-unblock' } })
  }
}
