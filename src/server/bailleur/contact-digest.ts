import { and, eq, gte, isNotNull, lt } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { contactRequests } from '~/server/db/schema/contacts'
import { owners } from '~/server/db/schema/owners'
import { sendContactDailyDigestEmail } from '~/server/services/brevo'
import { maskEmail } from '~/utils/mask-email'
import { loadMembers, type Member } from './inactivity-suspension'

/**
 * Récapitulatif quotidien des nouvelles demandes de contact (Trello #1044).
 * Envoyé chaque matin aux administrateurs et gestionnaires concernés, avec les
 * demandes confirmées la veille (jour civil Europe/Paris), groupées par résidence.
 */

const PARIS_TZ = 'Europe/Paris'

/** Décalage UTC (en minutes) de l'heure de Paris à l'instant donné — gère les changements d'heure. */
function parisOffsetMinutes(at: Date): number {
  const formatted = new Intl.DateTimeFormat('en-US', { timeZone: PARIS_TZ, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value
  const match = formatted?.match(/GMT([+-])(\d{2}):(\d{2})/)
  if (!match) return 0
  const sign = match[1] === '-' ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3]))
}

/** Minuit (heure de Paris) du jour civil parisien contenant `at`, exprimé en UTC. */
function parisMidnightUTC(at: Date): Date {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS_TZ }).format(at).split('-').map(Number)
  // Première approximation à minuit UTC, puis correction par l'offset de Paris à cette date.
  const approx = new Date(Date.UTC(y, m - 1, d))
  return new Date(approx.getTime() - parisOffsetMinutes(approx) * 60_000)
}

/** Fenêtre du récapitulatif : la veille de `now`, en jour civil Europe/Paris. */
export function digestWindow(now: Date): { start: Date; end: Date } {
  const end = parisMidnightUTC(now)
  // 12h en arrière depuis minuit tombe en milieu de veille quelle que soit sa durée (23h à 25h
  // selon les changements d'heure), dont on reprend le minuit.
  const start = parisMidnightUTC(new Date(end.getTime() - 12 * 3_600_000))
  return { start, end }
}

/** « jeudi 24 septembre » — formulation validée sur la fiche Notion. */
export function formatDigestDate(day: Date): string {
  return day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: PARIS_TZ })
}

type ResidenceCount = { accommodationId: number; name: string; ownerId: number; count: number }

/** Administrateurs du bailleur, et gestionnaires autorisés à modérer avec la résidence dans leur périmètre. */
export function digestRecipients(members: Member[], residence: { accommodationId: number; ownerId: number }): Member[] {
  return members.filter((m) => {
    if (m.ownerId !== residence.ownerId) return false
    if (m.bailleurRole === 'administrator') return true
    if (m.bailleurRole !== 'gestionnaire' || !m.bailleurPermissions.includes('manage_applications')) return false
    return m.scope === null || m.scope.has(residence.accommodationId)
  })
}

/** Groupe les lignes par destinataire : chacun ne voit que ses résidences. */
export function groupByRecipient(residences: ResidenceCount[], members: Member[]) {
  const byRecipient = new Map<string, { member: Member; residences: Array<{ name: string; count: number }> }>()
  for (const residence of residences) {
    for (const member of digestRecipients(members, residence)) {
      const entry = byRecipient.get(member.id) ?? { member, residences: [] }
      entry.residences.push({ name: residence.name, count: residence.count })
      byRecipient.set(member.id, entry)
    }
  }
  return [...byRecipient.values()].map(({ member, residences: lines }) => ({
    member,
    residences: [...lines].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    totalCount: lines.reduce((sum, l) => sum + l.count, 0),
  }))
}

type ContactDigestOptions = { dryRun?: boolean; verbose?: boolean; now?: Date; ownerSlug?: string; sendOutsideProduction?: boolean }

export type ContactDigestResult = { contacts: number; residences: number; recipients: number; failures: string[] }

export async function runContactDigest(options: ContactDigestOptions = {}): Promise<ContactDigestResult> {
  const now = options.now ?? new Date()
  const { start, end } = digestWindow(now)

  if (options.ownerSlug) {
    const owner = await db.query.owners.findFirst({ where: eq(owners.slug, options.ownerSlug), columns: { id: true } })
    if (!owner) throw new Error(`Bailleur introuvable pour le slug « ${options.ownerSlug} »`)
  }

  const conditions = [isNotNull(contactRequests.confirmedAt), gte(contactRequests.confirmedAt, start), lt(contactRequests.confirmedAt, end)]
  if (options.ownerSlug) conditions.push(eq(owners.slug, options.ownerSlug))

  const rows = await db
    .select({ accommodationId: accommodations.id, name: accommodations.name, ownerId: accommodations.ownerId })
    .from(contactRequests)
    .innerJoin(accommodations, eq(contactRequests.accommodationId, accommodations.id))
    .innerJoin(owners, eq(accommodations.ownerId, owners.id))
    .where(and(...conditions))

  const byResidence = new Map<number, ResidenceCount>()
  for (const row of rows) {
    if (row.ownerId === null) continue
    const entry = byResidence.get(row.accommodationId) ?? { ...row, ownerId: row.ownerId, count: 0 }
    entry.count += 1
    byResidence.set(row.accommodationId, entry)
  }
  const residences = [...byResidence.values()]

  const members = await loadMembers([...new Set(residences.map((r) => r.ownerId))])
  const grouped = groupByRecipient(residences, members)
  const date = formatDigestDate(start)

  if (options.verbose || options.dryRun) {
    console.log(`  Fenêtre : ${start.toISOString()} → ${end.toISOString()} (« ${date} »)`)
    for (const { member, residences: lines, totalCount } of grouped) {
      console.log(`  ${maskEmail(member.email)} : ${totalCount} demande(s) — ${lines.map((l) => `${l.name} (${l.count})`).join(', ')}`)
    }
  }

  const failures: string[] = []
  if (!options.dryRun) {
    for (const { member, residences: lines, totalCount } of grouped) {
      try {
        await sendContactDailyDigestEmail(member.email, { date, residences: lines, totalCount }, { force: options.sendOutsideProduction })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push(`e-mail ${maskEmail(member.email)} : ${message}`)
      }
    }
  }

  return { contacts: rows.length, residences: residences.length, recipients: grouped.length, failures }
}
