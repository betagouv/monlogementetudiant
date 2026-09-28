import { and, eq, inArray, max, min, ne, type SQL, sql } from 'drizzle-orm'
import { EContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { visibleContactRequest, visibleDossierFacileApplication } from '~/server/candidatures/visibility'
import { db } from '~/server/db'
import { accommodationTypologies } from '~/server/db/schema/accommodation-typologies'
import { accommodations } from '~/server/db/schema/accommodations'
import { user } from '~/server/db/schema/auth'
import { bailleurAccommodationScopes } from '~/server/db/schema/bailleur-accommodation-scopes'
import { contactRequests } from '~/server/db/schema/contacts'
import { dossierFacileApplications, dossierFacileTenants } from '~/server/db/schema/dossier-facile'
import { owners } from '~/server/db/schema/owners'
import { env } from '~/server/env'
import { logActivity } from '~/server/services/activity-logger'
import { sendApplicationsAutoSuspendedEmail, sendApplicationsInactivityWarningEmail } from '~/server/services/brevo'
import { maskEmail } from '~/utils/mask-email'
import {
  decideInactivity,
  INACTIVITY_THRESHOLDS,
  type InactivityDecision,
  type InactivityReason,
  type ResidenceInactivityState,
} from './inactivity-rules'
import type { BailleurPermission } from './permissions'

type EvaluatedResidence = Awaited<ReturnType<typeof evaluateResidences>>[number]

const REASON_SUBJECTS: Record<InactivityReason, string> = {
  unprocessed_applications: 'candidatures non traitées',
  stale_availability: 'disponibilités non mises à jour',
}

const warningLine = (reason: InactivityReason) => {
  const { warningDays, suspensionDays } = INACTIVITY_THRESHOLDS[reason]
  return `${REASON_SUBJECTS[reason]} depuis ${warningDays} jours, suspension au ${suspensionDays}e jour`
}

const suspensionLine = (reason: InactivityReason) =>
  `${REASON_SUBJECTS[reason]} depuis ${INACTIVITY_THRESHOLDS[reason].suspensionDays} jours`

const REASON_PERMISSIONS: Record<InactivityReason, BailleurPermission> = {
  unprocessed_applications: 'manage_applications',
  stale_availability: 'manage_residences',
}

const CONTACTS_URL = `${env.BASE_URL}/bailleur/contacts`

/** Résidences ouvertes aux candidatures d'un bailleur ayant choisi un parcours, avec ce qu'il faut pour les juger. */
export async function evaluateResidences({ accommodationIds }: { accommodationIds?: number[] } = {}) {
  const pendingContactsSince = db
    .select({ since: min(sql`coalesce(${contactRequests.reviewedAt}, ${contactRequests.confirmedAt}, ${contactRequests.createdAt})`) })
    .from(contactRequests)
    .where(
      and(
        eq(contactRequests.accommodationId, accommodations.id),
        eq(contactRequests.status, EContactStatus.A_CONTACTER),
        visibleContactRequest(),
      ),
    )

  const pendingApplicationsSince = db
    .select({ since: min(sql`coalesce(${dossierFacileApplications.reviewedAt}, ${dossierFacileApplications.createdAt})`) })
    .from(dossierFacileApplications)
    .innerJoin(dossierFacileTenants, eq(dossierFacileApplications.tenantId, dossierFacileTenants.id))
    .where(
      and(
        eq(dossierFacileApplications.accommodationSlug, accommodations.slug),
        eq(dossierFacileApplications.status, EContactStatus.A_MODERER),
        visibleDossierFacileApplication(),
      ),
    )

  const lastAvailabilityAt = db
    .select({ at: max(accommodationTypologies.availabilityUpdatedAt) })
    .from(accommodationTypologies)
    .where(eq(accommodationTypologies.accommodationId, accommodations.id))

  const conditions: Array<SQL | undefined> = [
    ne(owners.contactMode, EOwnerContactMode.NONE),
    eq(accommodations.acceptsApplications, true),
    accommodationIds ? inArray(accommodations.id, accommodationIds) : undefined,
  ]

  return db
    .select({
      id: accommodations.id,
      name: accommodations.name,
      slug: accommodations.slug,
      createdAt: accommodations.createdAt,
      suspendedAt: accommodations.applicationsSuspendedAt,
      suspensionReason: accommodations.applicationsSuspensionReason,
      unprocessedApplicationsWarnedAt: accommodations.unprocessedApplicationsWarnedAt,
      staleAvailabilityWarnedAt: accommodations.staleAvailabilityWarnedAt,
      ownerId: owners.id,
      ownerName: owners.name,
      contactMode: owners.contactMode,
      availabilityImported: owners.availabilityImported,
      pendingContactsSince: sql`(${pendingContactsSince})`.mapWith(contactRequests.createdAt),
      pendingApplicationsSince: sql`(${pendingApplicationsSince})`.mapWith(dossierFacileApplications.createdAt),
      lastAvailabilityAt: sql`(${lastAvailabilityAt})`.mapWith(accommodationTypologies.availabilityUpdatedAt),
    })
    .from(accommodations)
    .innerJoin(owners, eq(owners.id, accommodations.ownerId))
    .where(and(...conditions))
}

export function toInactivityState(residence: EvaluatedResidence): ResidenceInactivityState {
  return {
    pendingSince:
      residence.contactMode === EOwnerContactMode.DOSSIER_FACILE ? residence.pendingApplicationsSince : residence.pendingContactsSince,
    availabilitySince: residence.availabilityImported ? null : (residence.lastAvailabilityAt ?? residence.createdAt),
    warnedAt: {
      unprocessed_applications: residence.unprocessedApplicationsWarnedAt,
      stale_availability: residence.staleAvailabilityWarnedAt,
    },
    suspendedAt: residence.suspendedAt,
    suspensionReason: residence.suspensionReason,
  }
}

const WARNED_AT_COLUMN = {
  unprocessed_applications: 'unprocessedApplicationsWarnedAt',
  stale_availability: 'staleAvailabilityWarnedAt',
} as const

async function applyDecision(residence: EvaluatedResidence, decision: InactivityDecision, now: Date) {
  const set: Partial<typeof accommodations.$inferInsert> = {}
  for (const reason of decision.clearWarnings) set[WARNED_AT_COLUMN[reason]] = null
  for (const reason of decision.warn) set[WARNED_AT_COLUMN[reason]] = now
  if (decision.resume) {
    set.applicationsSuspendedAt = null
    set.applicationsSuspendedById = null
    set.applicationsSuspensionReason = null
  }
  if (decision.suspend) {
    set.applicationsSuspendedAt = now
    set.applicationsSuspendedById = null
    set.applicationsSuspensionReason = decision.suspend
  }
  if (Object.keys(set).length === 0) return

  await db.update(accommodations).set(set).where(eq(accommodations.id, residence.id))

  const log = (action: string, metadata: Record<string, unknown>) =>
    logActivity({
      action,
      entityType: 'accommodation',
      entityName: residence.name,
      ownerId: residence.ownerId,
      ownerName: residence.ownerName,
      metadata: { slug: residence.slug, ...metadata },
    })

  if (decision.resume) await log('accommodation.applications_auto_resumed', { reason: residence.suspensionReason })
  for (const reason of decision.warn) await log('accommodation.applications_inactivity_warned', { reason })
  if (decision.suspend) await log('accommodation.applications_auto_suspended', { reason: decision.suspend })
}

const hasAction = (decision: InactivityDecision) =>
  decision.clearWarnings.length > 0 || decision.warn.length > 0 || decision.suspend !== null || decision.resume

/**
 * Levée immédiate d'une suspension automatique dès que la cause disparaît (candidature traitée,
 * disponibilités mises à jour), sans attendre le prochain passage du cron. N'alerte ni ne suspend.
 */
export async function resumeIfResolved(accommodationId: number, now = new Date()) {
  try {
    const [residence] = await evaluateResidences({ accommodationIds: [accommodationId] })
    if (!residence) return
    const decision = decideInactivity(toInactivityState(residence), now)
    await applyDecision(residence, { clearWarnings: decision.clearWarnings, warn: [], suspend: null, resume: decision.resume }, now)
  } catch (err) {
    console.error('Erreur levée de suspension automatique', err)
  }
}

type Member = {
  id: string
  email: string
  firstname: string
  ownerId: number
  bailleurRole: 'administrator' | 'gestionnaire' | null
  bailleurPermissions: BailleurPermission[]
  scope: Set<number> | null
}

async function loadMembers(ownerIds: number[]): Promise<Member[]> {
  if (ownerIds.length === 0) return []
  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      firstname: user.firstname,
      ownerId: user.ownerId,
      bailleurRole: user.bailleurRole,
      bailleurPermissions: user.bailleurPermissions,
      applicationScopeRestricted: user.applicationScopeRestricted,
    })
    .from(user)
    .where(and(inArray(user.ownerId, ownerIds), eq(user.role, 'owner'), eq(user.banned, false)))

  const restrictedIds = rows.filter((r) => r.applicationScopeRestricted).map((r) => r.id)
  const scopeRows =
    restrictedIds.length > 0
      ? await db
          .select({ userId: bailleurAccommodationScopes.userId, accommodationId: bailleurAccommodationScopes.accommodationId })
          .from(bailleurAccommodationScopes)
          .where(inArray(bailleurAccommodationScopes.userId, restrictedIds))
      : []

  return rows.map(({ applicationScopeRestricted, ownerId, ...rest }) => ({
    ...rest,
    ownerId: ownerId as number,
    scope: applicationScopeRestricted ? new Set(scopeRows.filter((s) => s.userId === rest.id).map((s) => s.accommodationId)) : null,
  }))
}

/** Administrateurs du bailleur, et gestionnaires qui ont la résidence dans leur périmètre avec l'autorisation concernée. */
export const inactivityRecipients = (members: Member[], residence: { id: number; ownerId: number }, reason: InactivityReason) =>
  members.filter((m) => {
    if (m.ownerId !== residence.ownerId) return false
    if (m.bailleurRole === 'administrator') return true
    if (m.bailleurRole !== 'gestionnaire' || !m.bailleurPermissions.includes(REASON_PERMISSIONS[reason])) return false
    return m.scope === null || m.scope.has(residence.id)
  })

type Notice = { residence: EvaluatedResidence; reason: InactivityReason }

async function sendGroupedEmails(
  notices: Notice[],
  members: Member[],
  send: typeof sendApplicationsInactivityWarningEmail,
  describe: (reason: InactivityReason) => string,
  failures: string[],
) {
  const byRecipient = new Map<string, { member: Member; ownerName: string; lines: string[] }>()
  for (const { residence, reason } of notices) {
    for (const member of inactivityRecipients(members, residence, reason)) {
      const entry = byRecipient.get(member.id) ?? { member, ownerName: residence.ownerName, lines: [] }
      entry.lines.push(`${residence.name} : ${describe(reason)}`)
      byRecipient.set(member.id, entry)
    }
  }

  for (const { member, ownerName, lines } of byRecipient.values()) {
    try {
      await send(member.email, { firstname: member.firstname, ownerName, residences: lines, url: CONTACTS_URL })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`e-mail ${maskEmail(member.email)} : ${message}`)
    }
  }
}

type InactivityCheckOptions = { dryRun?: boolean; verbose?: boolean; now?: Date }

export type InactivityCheckResult = { warned: number; suspended: number; resumed: number; cleared: number; failures: string[] }

export async function runInactivityCheck(options: InactivityCheckOptions = {}): Promise<InactivityCheckResult> {
  const now = options.now ?? new Date()
  const plans = (await evaluateResidences())
    .map((residence) => ({ residence, decision: decideInactivity(toInactivityState(residence), now) }))
    .filter(({ decision }) => hasAction(decision))

  const result: InactivityCheckResult = {
    warned: plans.filter((p) => p.decision.warn.length > 0).length,
    suspended: plans.filter((p) => p.decision.suspend).length,
    resumed: plans.filter((p) => p.decision.resume).length,
    cleared: plans.filter((p) => p.decision.clearWarnings.length > 0).length,
    failures: [],
  }

  if (options.verbose) {
    for (const { residence, decision } of plans) {
      console.log(`  ${residence.name} (${residence.ownerName}) : ${JSON.stringify(decision)}`)
    }
  }
  if (options.dryRun) return result

  const warnings: Notice[] = []
  const suspensions: Notice[] = []
  for (const { residence, decision } of plans) {
    try {
      await applyDecision(residence, decision, now)
      for (const reason of decision.warn) warnings.push({ residence, reason })
      if (decision.suspend) suspensions.push({ residence, reason: decision.suspend })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result.failures.push(`${residence.slug} : ${message}`)
    }
  }

  const members = await loadMembers([...new Set([...warnings, ...suspensions].map((n) => n.residence.ownerId))])
  await sendGroupedEmails(warnings, members, sendApplicationsInactivityWarningEmail, warningLine, result.failures)
  await sendGroupedEmails(suspensions, members, sendApplicationsAutoSuspendedEmail, suspensionLine, result.failures)

  return result
}
