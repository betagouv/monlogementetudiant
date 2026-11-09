import { and, eq, inArray, type SQL } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodationAddresses } from '~/server/db/schema/accommodation-addresses'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { owners } from '~/server/db/schema/owners'
import { env } from '~/server/env'
import { type SendAvailabilityRecapEmail, sendAvailabilityMonthlyRecapEmail, sendAvailabilityResetDoneEmail } from '~/server/services/brevo'
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

type RecapRecipient = { email: string; firstname: string; userId: string; ownerId: number; ownerName: string }

/** Administrateurs du bailleur et gestionnaires `manage_residences` qui ont la résidence dans leur périmètre. */
async function groupByRecipient<R extends { ownerId: number; ownerName: string; id: number }>(residences: R[]) {
  const members = await loadMembers([...new Set(residences.map((r) => r.ownerId))])
  const byRecipient = new Map<string, { recipient: RecapRecipient; residences: R[] }>()
  for (const residence of residences) {
    for (const member of inactivityRecipients(members, residence, 'stale_availability')) {
      const entry = byRecipient.get(member.id) ?? {
        recipient: {
          email: member.email,
          firstname: member.firstname,
          userId: member.id,
          ownerId: member.ownerId,
          ownerName: residence.ownerName,
        },
        residences: [],
      }
      entry.residences.push(residence)
      byRecipient.set(member.id, entry)
    }
  }
  return [...byRecipient.values()]
}

async function sendToEach<R>(
  groups: { recipient: RecapRecipient; residences: R[] }[],
  send: (group: { recipient: RecapRecipient; residences: R[] }) => Promise<unknown>,
  failures: string[],
) {
  let sent = 0
  for (const group of groups) {
    try {
      await send(group)
      sent++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`e-mail ${maskEmail(group.recipient.email)} : ${message}`)
    }
  }
  return sent
}

type SendRecapOptions = {
  residences: RecapResidence[]
  send: SendAvailabilityRecapEmail
  /** L'alerte ne porte que sur les résidences en alerte : son lien ne confirme qu'elles. */
  onlyWarned: boolean
  issuedAt: Date
  deadline?: Date
  force: boolean
  failures: string[]
}

/** Un e-mail par destinataire, chacun avec son propre lien « Rien n'a changé ». */
export async function sendAvailabilityRecapEmails({ residences, send, onlyWarned, issuedAt, deadline, force, failures }: SendRecapOptions) {
  return sendToEach(
    await groupByRecipient(residences),
    async ({ recipient, residences: recipientResidences }) => {
      const token = createAvailabilityConfirmToken({ userId: recipient.userId, ownerId: recipient.ownerId, onlyWarned }, issuedAt)
      await send(
        recipient.email,
        {
          firstname: recipient.firstname,
          ownerName: recipient.ownerName,
          residences: recipientResidences,
          confirmUrl: `${AVAILABILITY_CONFIRM_URL}?jeton=${encodeURIComponent(token)}`,
          updateUrl: RESIDENCES_URL,
          deadline,
        },
        { force },
      )
    },
    failures,
  )
}

/** Disponibilités repassées en « non communiquée » : un e-mail par destinataire avec ses résidences. */
export async function sendAvailabilityResetDoneEmails({
  residences,
  force,
  failures,
}: {
  residences: { id: number; name: string; city: string | null; ownerId: number; ownerName: string }[]
  force: boolean
  failures: string[]
}) {
  return sendToEach(
    await groupByRecipient(residences),
    ({ recipient, residences: recipientResidences }) =>
      sendAvailabilityResetDoneEmail(
        recipient.email,
        { firstname: recipient.firstname, ownerName: recipient.ownerName, residences: recipientResidences, updateUrl: RESIDENCES_URL },
        { force },
      ),
    failures,
  )
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
