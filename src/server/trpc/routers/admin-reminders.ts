import { TRPCError } from '@trpc/server'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { EReminderType, ZReminderType } from '~/enums/reminder-email'
import { db } from '~/server/db'
import { user } from '~/server/db/schema/auth'
import { brevoUnblockEvents } from '~/server/db/schema/brevo-unblock'
import { owners } from '~/server/db/schema/owners'
import { env } from '~/server/env'
import { loadReminderEfficacy } from '~/server/reminders/load-reminder-efficacy'
import type { TReminderEfficacyStatus } from '~/server/reminders/reminder-efficacy'
import {
  BLOCKED_REASONS,
  fetchBlockedContacts,
  fetchReminderMessages,
  isBlockedReason,
  type TBrevoEmailStatus,
} from '~/server/services/brevo-reminders'
import { adminProcedure, createTRPCRouter } from '../init'

const PAGE_SIZE = 25

const BREVO_ERROR_MESSAGE = 'Impossible de joindre Brevo, réessayez plus tard.'

const TEMPLATE_TYPES: [number, EReminderType][] = [
  [Number(env.BREVO_TEMPLATE_AVAILABILITY_MONTHLY_RECAP), EReminderType.AVAILABILITY_MONTHLY_RECAP],
  [Number(env.BREVO_TEMPLATE_AVAILABILITY_RESET_WARNING), EReminderType.AVAILABILITY_RESET_WARNING],
  [Number(env.BREVO_TEMPLATE_AVAILABILITY_RESET_DONE), EReminderType.AVAILABILITY_RESET_DONE],
  [Number(env.BREVO_TEMPLATE_APPLICATIONS_INACTIVITY_WARNING), EReminderType.APPLICATIONS_INACTIVITY_WARNING],
  [Number(env.BREVO_TEMPLATE_APPLICATIONS_AUTO_SUSPENDED), EReminderType.APPLICATIONS_AUTO_SUSPENDED],
]

const dayOf = (date: Date) => date.toISOString().slice(0, 10)

const withBrevo = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call()
  } catch (cause) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: BREVO_ERROR_MESSAGE, cause })
  }
}

type TRecipient = { userName: string | null; ownerId: number | null; ownerName: string | null }

const loadRecipients = async (emails: string[]): Promise<Map<string, TRecipient>> => {
  const recipients = new Map<string, TRecipient>()
  const unique = [...new Set(emails)]
  if (unique.length === 0) return recipients

  const rows = await db
    .select({
      email: sql<string>`lower(${user.email})`,
      userName: sql<string | null>`nullif(trim(concat_ws(' ', ${user.firstname}, ${user.lastname})), '')`,
      accountName: user.name,
      ownerId: user.ownerId,
      ownerName: owners.name,
    })
    .from(user)
    .leftJoin(owners, eq(owners.id, user.ownerId))
    .where(and(eq(user.role, 'owner'), inArray(sql`lower(${user.email})`, unique)))

  for (const row of rows) {
    recipients.set(row.email, {
      userName: row.userName ?? row.accountName,
      ownerId: row.ownerId,
      ownerName: row.ownerName,
    })
  }
  return recipients
}

const paginate = <T>(items: T[], page: number) => ({
  rows: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  total: items.length,
  pageCount: Math.ceil(items.length / PAGE_SIZE),
})

const UNBLOCK_PAGE_SIZE = 20

const EMPTY_RECIPIENT: TRecipient = { userName: null, ownerId: null, ownerName: null }

const DELIVERED_STATUSES: TBrevoEmailStatus[] = ['delivered', 'opened', 'clicked']
const OPENED_STATUSES: TBrevoEmailStatus[] = ['opened', 'clicked']

export const adminRemindersRouter = createTRPCRouter({
  sentEmails: adminProcedure
    .input(
      z.object({
        page: z.number().default(1),
        from: z.string(),
        to: z.string(),
        type: ZReminderType.optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const templates = TEMPLATE_TYPES.filter(([, type]) => !input.type || type === input.type)
      const messages = await withBrevo(() =>
        fetchReminderMessages({ templateIds: templates.map(([id]) => id), from: input.from, to: input.to }),
      )

      const recipients = await loadRecipients(messages.map((m) => m.email))
      const typeByTemplate = new Map(templates)
      const term = input.search && input.search.length >= 2 ? input.search.toLowerCase() : null

      const entries = messages
        .flatMap((message) => {
          const type = typeByTemplate.get(message.templateId)
          if (!type) return []
          return [{ message, type, recipient: recipients.get(message.email) ?? EMPTY_RECIPIENT }]
        })
        .filter(({ message, recipient }) => {
          if (!term) return true
          return [message.email, recipient.userName, recipient.ownerName].some((value) => value?.toLowerCase().includes(term))
        })
        .sort((a, b) => b.message.sentAt.getTime() - a.message.sentAt.getTime())

      const efficacy = await loadReminderEfficacy(entries.map((e) => e.message.messageId))

      const resolved = entries.map(({ message, type, recipient }) => {
        const found = efficacy.get(message.messageId)
        return {
          messageId: message.messageId,
          sentAt: message.sentAt,
          type,
          email: message.email,
          ...recipient,
          status: message.status,
          efficacy: (found?.status ?? 'not_measured') as TReminderEfficacyStatus,
          reactionMs: found?.reactionMs ?? null,
          residencesCount: found?.residencesCount ?? null,
        }
      })

      const countBy = (predicate: (row: (typeof resolved)[number]) => boolean) => resolved.filter(predicate).length
      const summary = {
        sent: resolved.length,
        delivered: countBy((r) => DELIVERED_STATUSES.includes(r.status)),
        opened: countBy((r) => OPENED_STATUSES.includes(r.status)),
        effective: countBy((r) => r.efficacy === 'effective'),
        failed: countBy((r) => r.efficacy === 'failed'),
        pending: countBy((r) => r.efficacy === 'pending'),
      }

      return { ...paginate(resolved, input.page), summary }
    }),

  blockedContacts: adminProcedure
    .input(
      z.object({
        page: z.number().default(1),
        from: z.string(),
        to: z.string(),
        reason: z.enum(BLOCKED_REASONS).optional(),
      }),
    )
    .query(async ({ input }) => {
      const contacts = await withBrevo(fetchBlockedContacts)
      const recipients = await loadRecipients(contacts.map((c) => c.email))

      const managers = contacts
        .filter((c) => recipients.has(c.email))
        .map((c) => ({
          email: c.email,
          blockedAt: c.blockedAt,
          reason: c.reason,
          ...(recipients.get(c.email) ?? EMPTY_RECIPIENT),
        }))

      const inPeriod = managers.filter((c) => {
        const day = dayOf(c.blockedAt)
        return day >= input.from && day <= input.to
      })
      const filtered = inPeriod
        .filter((c) => !input.reason || c.reason === input.reason)
        .sort((a, b) => b.blockedAt.getTime() - a.blockedAt.getTime())

      return {
        ...paginate(filtered, input.page),
        summary: {
          blockedInPeriod: inPeriod.length,
          unsubscribedInPeriod: inPeriod.filter((c) => c.reason?.startsWith('unsubscribedVia')).length,
          totalBlocked: managers.length,
        },
      }
    }),

  unblockHistory: adminProcedure.input(z.object({ page: z.number().int().min(1).default(1) })).query(async ({ input }) => {
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(brevoUnblockEvents)
    const events = await db
      .select({
        id: brevoUnblockEvents.id,
        createdAt: brevoUnblockEvents.createdAt,
        email: brevoUnblockEvents.email,
        reason: brevoUnblockEvents.reason,
        trigger: brevoUnblockEvents.trigger,
        status: brevoUnblockEvents.status,
        firstname: user.firstname,
        lastname: user.lastname,
        accountName: user.name,
      })
      .from(brevoUnblockEvents)
      .leftJoin(user, eq(user.id, brevoUnblockEvents.userId))
      .orderBy(desc(brevoUnblockEvents.createdAt), desc(brevoUnblockEvents.id))
      .limit(UNBLOCK_PAGE_SIZE)
      .offset((input.page - 1) * UNBLOCK_PAGE_SIZE)

    const rows = events.map((event) => ({
      id: event.id,
      createdAt: event.createdAt,
      email: event.email,
      userName: [event.firstname, event.lastname].filter(Boolean).join(' ').trim() || event.accountName || null,
      reason: isBlockedReason(event.reason) ? event.reason : null,
      trigger: event.trigger,
      status: event.status,
    }))
    return { rows, total, pageCount: Math.ceil(total / UNBLOCK_PAGE_SIZE) }
  }),
})
