import { and, eq, inArray, type SQL } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { owners } from '~/server/db/schema/owners'
import { env } from '~/server/env'
import { type SendAvailabilityRecapEmail, sendAvailabilityMonthlyRecapEmail } from '~/server/services/brevo'
import { maskEmail } from '~/utils/mask-email'
import { createAvailabilityConfirmToken } from './availability-confirm-token'
import { loadAvailabilitySummaries, mainAddressJoin, withAvailabilityCondition } from './availability-confirmation'
import { inactivityRecipients, loadMembers } from './inactivity-suspension'

export const AVAILABILITY_CONFIRM_URL = `${env.BASE_URL}/api/disponibilites/confirmer`
const RESIDENCES_URL = `${env.BASE_URL}/bailleur/residences`

export type RecapResidence = Awaited<ReturnType<typeof loadRecapResidences>>[number]

/** Résidences avec ce que montre l'e-mail : ville, total disponible, dernière mise à jour. */
export async function loadRecapResidences(conditions: SQL | undefined) {
  const residences = await db
    .select({
      id: accommodations.id,
      name: accommodations.name,
      slug: accommodations.slug,
      city: cities.name,
      ownerId: owners.id,
      ownerName: owners.name,
    })
    .from(accommodations)
    .innerJoin(owners, eq(owners.id, accommodations.ownerId))
    .leftJoin(accommodationAddresses, mainAddressJoin)
    .leftJoin(cities, eq(cities.id, accommodationAddresses.cityId))
    .where(and(withAvailabilityCondition, conditions))
    .orderBy(accommodations.name)

  const summaries = await loadAvailabilitySummaries(residences.map((r) => r.id))
  return residences.map((residence) => ({
    ...residence,
    nbAvailable: summaries.get(residence.id)?.nbAvailable ?? 0,
    lastUpdatedAt: summaries.get(residence.id)?.lastUpdatedAt ?? null,
  }))
}

export const recapResidencesByIds = (ids: number[]) =>
  ids.length === 0 ? Promise.resolve([]) : loadRecapResidences(inArray(accommodations.id, ids))

type SendRecapOptions = {
  residences: RecapResidence[]
  send: SendAvailabilityRecapEmail
  /** L'alerte ne porte que sur les résidences en alerte : son lien ne confirme qu'elles. */
  onlyWarned: boolean
  issuedAt: Date
  force: boolean
  failures: string[]
}

/**
 * Un e-mail par destinataire : administrateurs du bailleur et gestionnaires `manage_residences`
 * qui ont la résidence dans leur périmètre. Chacun reçoit son propre lien « Rien n'a changé ».
 */
export async function sendAvailabilityRecapEmails({ residences, send, onlyWarned, issuedAt, force, failures }: SendRecapOptions) {
  const members = await loadMembers([...new Set(residences.map((r) => r.ownerId))])
  const byRecipient = new Map<string, { member: (typeof members)[number]; ownerName: string; residences: RecapResidence[] }>()
  for (const residence of residences) {
    for (const member of inactivityRecipients(members, residence, 'stale_availability')) {
      const entry = byRecipient.get(member.id) ?? { member, ownerName: residence.ownerName, residences: [] }
      entry.residences.push(residence)
      byRecipient.set(member.id, entry)
    }
  }

  let sent = 0
  for (const { member, ownerName, residences: memberResidences } of byRecipient.values()) {
    const token = createAvailabilityConfirmToken({ userId: member.id, ownerId: member.ownerId, onlyWarned }, issuedAt)
    try {
      await send(
        member.email,
        {
          firstname: member.firstname,
          ownerName,
          residences: memberResidences,
          confirmUrl: `${AVAILABILITY_CONFIRM_URL}?jeton=${encodeURIComponent(token)}`,
          updateUrl: RESIDENCES_URL,
        },
        { force },
      )
      sent++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`e-mail ${maskEmail(member.email)} : ${message}`)
    }
  }
  return sent
}

type MonthlyRecapOptions = { dryRun?: boolean; verbose?: boolean; now?: Date; ownerSlug?: string; sendOutsideProduction?: boolean }

export type MonthlyRecapResult = { residences: number; emails: number; failures: string[] }

/** Récap mensuel : toutes les résidences à disponibilités renseignées des bailleurs qui les saisissent à la main. */
export async function runAvailabilityMonthlyRecap(options: MonthlyRecapOptions = {}): Promise<MonthlyRecapResult> {
  const residences = await loadRecapResidences(
    and(eq(owners.availabilityImported, false), options.ownerSlug ? eq(owners.slug, options.ownerSlug) : undefined),
  )
  const result: MonthlyRecapResult = { residences: residences.length, emails: 0, failures: [] }

  if (options.verbose) {
    for (const residence of residences) {
      console.log(
        `  ${residence.name} (${residence.ownerName}) : ${residence.nbAvailable} dispo(s), dernière mise à jour ${residence.lastUpdatedAt?.toISOString() ?? 'jamais'}`,
      )
    }
  }
  if (options.dryRun) return result

  result.emails = await sendAvailabilityRecapEmails({
    residences,
    send: sendAvailabilityMonthlyRecapEmail,
    onlyWarned: false,
    issuedAt: options.now ?? new Date(),
    force: options.sendOutsideProduction ?? false,
    failures: result.failures,
  })
  return result
}
