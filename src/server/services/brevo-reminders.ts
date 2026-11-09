import { z } from 'zod'
import { env } from '~/server/env'

const BREVO_API_URL = 'https://api.brevo.com/v3'
const EVENTS_PAGE_SIZE = 2500
const BLOCKED_PAGE_SIZE = 100
const MAX_CHUNK_DAYS = 90
const TRAILING_DAYS = 31
const DAY_MS = 86_400_000

export type TBrevoEmailStatus = 'sent' | 'deferred' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'blocked' | 'error'

export type TBrevoMessage = {
  messageId: string
  email: string
  templateId: number
  sentAt: Date
  status: TBrevoEmailStatus
}

const ZBrevoEvent = z.object({
  date: z.string(),
  email: z.string(),
  event: z.string(),
  messageId: z.string(),
  templateId: z.number().nullish(),
})

const ZBrevoEventsResponse = z.object({ events: z.array(ZBrevoEvent).optional() })

export type TBrevoEvent = z.infer<typeof ZBrevoEvent>

export const BLOCKED_REASONS = [
  'unsubscribedViaEmail',
  'unsubscribedViaMA',
  'unsubscribedViaApi',
  'adminBlocked',
  'hardBounce',
  'contactFlaggedAsSpam',
] as const

export type TBlockedReason = (typeof BLOCKED_REASONS)[number]

export type TBlockedContact = { email: string; blockedAt: Date; reason: TBlockedReason | null }

const ZBlockedContactsResponse = z.object({
  contacts: z
    .array(
      z.object({
        email: z.string(),
        blockedAt: z.string(),
        reason: z.object({ code: z.string().nullish() }).nullish(),
      }),
    )
    .optional(),
})

const PRIORITY_STATUS: Record<string, TBrevoEmailStatus> = {
  hardBounces: 'bounced',
  invalid: 'bounced',
  blocked: 'blocked',
  error: 'error',
}

const PROGRESS_STATUS: [string, TBrevoEmailStatus][] = [
  ['clicks', 'clicked'],
  ['opened', 'opened'],
  ['delivered', 'delivered'],
  ['softBounces', 'deferred'],
  ['deferred', 'deferred'],
]

export const summarizeEvents = (events: TBrevoEvent[]): TBrevoMessage[] => {
  const byMessage = new Map<string, TBrevoEvent[]>()
  for (const event of events) {
    const group = byMessage.get(event.messageId)
    if (group) group.push(event)
    else byMessage.set(event.messageId, [event])
  }

  const messages: TBrevoMessage[] = []
  for (const [messageId, group] of byMessage) {
    const request = group.find((e) => e.event === 'requests')
    if (!request) continue

    const names = new Set(group.map((e) => e.event))
    const priority = [...names].map((n) => PRIORITY_STATUS[n]).find(Boolean)
    const progress = PROGRESS_STATUS.find(([name]) => names.has(name))?.[1]

    messages.push({
      messageId,
      email: request.email.toLowerCase(),
      templateId: request.templateId ?? 0,
      sentAt: new Date(request.date),
      status: priority ?? progress ?? 'sent',
    })
  }
  return messages
}

const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const dayMs = (day: string) => Date.parse(`${day}T00:00:00.000Z`)

const splitRange = (from: string, to: string): { start: string; end: string }[] => {
  const limit = Math.min(dayMs(to) + TRAILING_DAYS * DAY_MS, dayMs(toDay(Date.now())))
  const chunks: { start: string; end: string }[] = []
  let start = dayMs(from)
  while (start <= limit) {
    const end = Math.min(start + (MAX_CHUNK_DAYS - 1) * DAY_MS, limit)
    chunks.push({ start: toDay(start), end: toDay(end) })
    start = end + DAY_MS
  }
  return chunks
}

const brevoGet = async (endpoint: string, params: Record<string, string | number>) => {
  const url = new URL(`${BREVO_API_URL}${endpoint}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))

  const response = await fetch(url.toString(), {
    headers: { 'api-key': env.BREVO_API_KEY, accept: 'application/json' },
    next: { revalidate: 300 },
  })
  if (!response.ok) throw new Error(`Brevo ${endpoint} failed: ${response.status}`)
  return response.json()
}

const fetchTemplateEvents = async (templateId: number, from: string, to: string): Promise<TBrevoEvent[]> => {
  const events: TBrevoEvent[] = []
  for (const { start, end } of splitRange(from, to)) {
    let offset = 0
    while (true) {
      const json = await brevoGet('/smtp/statistics/events', {
        templateId,
        startDate: start,
        endDate: end,
        limit: EVENTS_PAGE_SIZE,
        offset,
      })
      const parsed = ZBrevoEventsResponse.safeParse(json)
      if (!parsed.success) throw new Error('Réponse Brevo invalide')
      const page = parsed.data.events ?? []
      events.push(...page)
      if (page.length < EVENTS_PAGE_SIZE) break
      offset += EVENTS_PAGE_SIZE
    }
  }
  return events
}

export const fetchReminderMessages = async ({
  templateIds,
  from,
  to,
}: {
  templateIds: number[]
  from: string
  to: string
}): Promise<TBrevoMessage[]> => {
  const messages: TBrevoMessage[] = []
  for (const templateId of templateIds) {
    const events = await fetchTemplateEvents(templateId, from, to)
    messages.push(...summarizeEvents(events.map((e) => ({ ...e, templateId: e.templateId ?? templateId }))))
  }
  return messages.filter((m) => {
    const day = m.sentAt.toISOString().slice(0, 10)
    return day >= from && day <= to
  })
}

const isBlockedReason = (code: string | null | undefined): code is TBlockedReason => BLOCKED_REASONS.some((reason) => reason === code)

export const fetchBlockedContacts = async (): Promise<TBlockedContact[]> => {
  const contacts: TBlockedContact[] = []
  let offset = 0
  while (true) {
    const json = await brevoGet('/smtp/blockedContacts', { limit: BLOCKED_PAGE_SIZE, offset })
    const parsed = ZBlockedContactsResponse.safeParse(json)
    if (!parsed.success) throw new Error('Réponse Brevo invalide')
    const page = parsed.data.contacts ?? []
    for (const c of page) {
      const code = c.reason?.code
      contacts.push({
        email: c.email.toLowerCase(),
        blockedAt: new Date(c.blockedAt),
        reason: isBlockedReason(code) ? code : null,
      })
    }
    if (page.length < BLOCKED_PAGE_SIZE) break
    offset += BLOCKED_PAGE_SIZE
  }
  return contacts
}
