import { and, eq, isNotNull, max, or, type SQL, sql } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { accommodations } from '~/server/db/schema/accommodations'
import { owners } from '~/server/db/schema/owners'
import { recomputeAndPersistAggregates } from '~/server/lib/typologies'
import { logActivity } from '~/server/services/activity-logger'
import { sendAvailabilityResetWarningEmail } from '~/server/services/brevo'
import { recapResidencesByIds, sendAvailabilityRecapEmails } from './availability-recap'
import { type AvailabilityResetAction, decideAvailabilityReset } from './inactivity-rules'
import { inInactivityScope } from './inactivity-suspension'

type StaleAvailabilityResetOptions = {
  dryRun?: boolean
  verbose?: boolean
  now?: Date
  ownerSlug?: string
  sendOutsideProduction?: boolean
}

export type StaleAvailabilityResetResult = { warned: number; reset: number; cleared: number; failures: string[] }

type Candidate = Awaited<ReturnType<typeof findCandidates>>[number]

/** Résidences hors import qui ont des disponibilités renseignées ou une alerte en cours. */
async function findCandidates(ownerSlug?: string) {
  const lastAvailabilityAt = db
    .select({ at: max(accommodationTypologies.availabilityUpdatedAt) })
    .from(accommodationTypologies)
    .where(eq(accommodationTypologies.accommodationId, accommodations.id))

  const withAvailability = db
    .select({ id: accommodationTypologies.id })
    .from(accommodationTypologies)
    .where(and(eq(accommodationTypologies.accommodationId, accommodations.id), isNotNull(accommodationTypologies.nbAvailable)))

  const conditions: Array<SQL | undefined> = [
    eq(owners.availabilityImported, false),
    or(sql`exists (${withAvailability})`, isNotNull(accommodations.staleAvailabilityWarnedAt)),
    ownerSlug ? eq(owners.slug, ownerSlug) : undefined,
  ]

  return db
    .select({
      id: accommodations.id,
      name: accommodations.name,
      slug: accommodations.slug,
      createdAt: accommodations.createdAt,
      acceptsApplications: accommodations.acceptsApplications,
      warnedAt: accommodations.staleAvailabilityWarnedAt,
      ownerId: owners.id,
      ownerName: owners.name,
      contactMode: owners.contactMode,
      hasAvailability: sql<boolean>`exists (${withAvailability})`,
      lastAvailabilityAt: sql`(${lastAvailabilityAt})`.mapWith(accommodationTypologies.availabilityUpdatedAt),
    })
    .from(accommodations)
    .innerJoin(owners, eq(owners.id, accommodations.ownerId))
    .where(and(...conditions))
}

async function applyAction(residence: Candidate, action: Exclude<AvailabilityResetAction, null>, now: Date) {
  if (action === 'warn' || action === 'clear') {
    await db
      .update(accommodations)
      .set({ staleAvailabilityWarnedAt: action === 'warn' ? now : null })
      .where(eq(accommodations.id, residence.id))
    if (action === 'clear') return
  } else {
    await db.transaction(async (tx) => {
      await tx
        .update(accommodationTypologies)
        .set({ nbAvailable: null, availabilityUpdatedAt: null, availabilityUpdatedBy: null })
        .where(eq(accommodationTypologies.accommodationId, residence.id))
      await recomputeAndPersistAggregates(tx, residence.id)
      // Hors suivi des candidatures, plus rien à alerter ; sinon l'alerte porte la suspension en cours.
      if (!inInactivityScope(residence)) {
        await tx.update(accommodations).set({ staleAvailabilityWarnedAt: null }).where(eq(accommodations.id, residence.id))
      }
    })
  }

  await logActivity({
    action: action === 'warn' ? 'accommodation.availability_reset_warned' : 'accommodation.availability_auto_reset',
    entityType: 'accommodation',
    entityName: residence.name,
    ownerId: residence.ownerId,
    ownerName: residence.ownerName,
    metadata: { slug: residence.slug, lastAvailabilityAt: residence.lastAvailabilityAt },
  })
}

export async function runStaleAvailabilityReset(options: StaleAvailabilityResetOptions = {}): Promise<StaleAvailabilityResetResult> {
  const now = options.now ?? new Date()
  const plans = (await findCandidates(options.ownerSlug))
    .map((residence) => ({
      residence,
      action: decideAvailabilityReset(
        {
          hasAvailability: residence.hasAvailability,
          availabilitySince: residence.lastAvailabilityAt ?? residence.createdAt,
          warnedAt: residence.warnedAt,
          inInactivityScope: inInactivityScope(residence),
        },
        now,
      ),
    }))
    .flatMap(({ residence, action }) => (action ? [{ residence, action }] : []))

  const count = (action: AvailabilityResetAction) => plans.filter((p) => p.action === action).length
  const result: StaleAvailabilityResetResult = { warned: count('warn'), reset: count('reset'), cleared: count('clear'), failures: [] }

  if (options.verbose) {
    for (const { residence, action } of plans) {
      console.log(
        `  ${residence.name} (${residence.ownerName}) : ${action}, dernière mise à jour ${residence.lastAvailabilityAt?.toISOString() ?? 'jamais'}`,
      )
    }
  }
  if (options.dryRun) return result

  const warned: Candidate[] = []
  for (const { residence, action } of plans) {
    try {
      await applyAction(residence, action, now)
      if (action === 'warn') warned.push(residence)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result.failures.push(`${residence.slug} : ${message}`)
    }
  }

  await sendAvailabilityRecapEmails({
    residences: await recapResidencesByIds(warned.map((r) => r.id)),
    send: sendAvailabilityResetWarningEmail,
    onlyWarned: true,
    issuedAt: now,
    force: options.sendOutsideProduction ?? false,
    failures: result.failures,
  })

  return result
}
