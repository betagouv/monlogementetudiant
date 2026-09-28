import { DAY_MS } from '~/utils/time'

export type InactivityReason = 'unprocessed_applications' | 'stale_availability'
export type SuspensionReason = 'manual' | InactivityReason

export const INACTIVITY_REASONS: InactivityReason[] = ['unprocessed_applications', 'stale_availability']

export const INACTIVITY_THRESHOLDS: Record<InactivityReason, { warningDays: number; suspensionDays: number }> = {
  unprocessed_applications: { warningDays: 7, suspensionDays: 10 },
  stale_availability: { warningDays: 23, suspensionDays: 30 },
}

/** Tolérance sur l'heure de passage du cron, pour qu'un préavis de N jours ne glisse pas à N + 1. */
const CRON_SLACK_MS = 12 * 60 * 60 * 1000

/** Préavis garanti entre l'alerte et le blocage, même pour une résidence déjà en retard à la première alerte. */
export const suspensionNoticeMs = (reason: InactivityReason) => {
  const { warningDays, suspensionDays } = INACTIVITY_THRESHOLDS[reason]
  return (suspensionDays - warningDays) * DAY_MS - CRON_SLACK_MS
}

export type ResidenceInactivityState = {
  /** Plus ancienne candidature encore à traiter, `null` s'il n'y en a pas. */
  pendingSince: Date | null
  /** Dernière mise à jour des disponibilités, `null` quand la règle ne s'applique pas (bailleur importé). */
  availabilitySince: Date | null
  warnedAt: Record<InactivityReason, Date | null>
  suspendedAt: Date | null
  suspensionReason: SuspensionReason | null
}

export type InactivityDecision = {
  clearWarnings: InactivityReason[]
  warn: InactivityReason[]
  suspend: InactivityReason | null
  resume: boolean
}

const sinceOf = (state: ResidenceInactivityState, reason: InactivityReason) =>
  reason === 'unprocessed_applications' ? state.pendingSince : state.availabilitySince

const isOverdue = (since: Date | null, days: number, now: Date) => since !== null && since.getTime() <= now.getTime() - days * DAY_MS

export function decideInactivity(state: ResidenceInactivityState, now: Date): InactivityDecision {
  const warningDue = (reason: InactivityReason) => isOverdue(sinceOf(state, reason), INACTIVITY_THRESHOLDS[reason].warningDays, now)
  const suspensionDue = (reason: InactivityReason) => isOverdue(sinceOf(state, reason), INACTIVITY_THRESHOLDS[reason].suspensionDays, now)

  const clearWarnings = INACTIVITY_REASONS.filter((reason) => state.warnedAt[reason] !== null && !warningDue(reason))

  const autoSuspended = state.suspendedAt !== null && state.suspensionReason !== 'manual'
  const resume = autoSuspended && !INACTIVITY_REASONS.some(suspensionDue)
  const suspended = state.suspendedAt !== null && !resume

  if (suspended) return { clearWarnings, warn: [], suspend: null, resume }

  const warn = INACTIVITY_REASONS.filter((reason) => warningDue(reason) && state.warnedAt[reason] === null)
  const suspend =
    INACTIVITY_REASONS.find((reason) => {
      const warnedAt = state.warnedAt[reason]
      return suspensionDue(reason) && warnedAt !== null && warnedAt.getTime() <= now.getTime() - suspensionNoticeMs(reason)
    }) ?? null

  return { clearWarnings, warn, suspend, resume }
}
