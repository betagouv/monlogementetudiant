import { DAY_MS } from '~/utils/time'

export type InactivityReason = 'unprocessed_applications' | 'stale_availability'
export type SuspensionReason = 'manual' | InactivityReason

export const INACTIVITY_REASONS: InactivityReason[] = ['unprocessed_applications', 'stale_availability']

export const INACTIVITY_WARNING_DAYS: Record<InactivityReason, number> = {
  unprocessed_applications: 14,
  stale_availability: 30,
}

/** Délai sans action après l'alerte avant la suspension. */
export const SUSPENSION_NOTICE_DAYS = 7

/** Tolérance sur l'heure de passage du cron, pour qu'un préavis de N jours ne glisse pas à N + 1. */
const CRON_RUN_TOLERANCE_MS = 12 * 60 * 60 * 1000

const SUSPENSION_NOTICE_MS = SUSPENSION_NOTICE_DAYS * DAY_MS - CRON_RUN_TOLERANCE_MS

const noticeElapsed = (warnedAt: Date | null, now: Date) => warnedAt !== null && warnedAt.getTime() <= now.getTime() - SUSPENSION_NOTICE_MS

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

/**
 * `allowResume` : une suspension automatique n'est levée que sur une action du bailleur. Le cron ne la lève
 * jamais, sans quoi une candidature sortie de la fenêtre de rétention rouvrirait la résidence toute seule.
 */
export function decideInactivity(
  state: ResidenceInactivityState,
  now: Date,
  { allowResume }: { allowResume: boolean },
): InactivityDecision {
  const warningDue = (reason: InactivityReason) => isOverdue(sinceOf(state, reason), INACTIVITY_WARNING_DAYS[reason], now)

  const clearWarnings = INACTIVITY_REASONS.filter((reason) => state.warnedAt[reason] !== null && !warningDue(reason))

  const autoReason = state.suspendedAt !== null && state.suspensionReason !== 'manual' ? state.suspensionReason : null
  const resume = allowResume && autoReason !== null && !warningDue(autoReason)
  const suspended = state.suspendedAt !== null && !resume

  if (suspended) return { clearWarnings, warn: [], suspend: null, resume }

  const warn = INACTIVITY_REASONS.filter((reason) => warningDue(reason) && state.warnedAt[reason] === null)
  const suspend = INACTIVITY_REASONS.find((reason) => warningDue(reason) && noticeElapsed(state.warnedAt[reason], now)) ?? null

  return { clearWarnings, warn, suspend, resume }
}

export type AvailabilityResetState = {
  hasAvailability: boolean
  /** Dernière mise à jour des disponibilités par un gestionnaire, à défaut création de la résidence. */
  availabilitySince: Date
  warnedAt: Date | null
  /** Résidence suivie par `decideInactivity`, qui gère alors seule l'alerte. */
  inInactivityScope: boolean
}

export type AvailabilityResetAction = 'warn' | 'reset' | 'clear' | null

/** Disponibilités périmées : alerte à 30 jours, puis « non communiquée » si rien n'est fait dans les 7 jours. */
export function decideAvailabilityReset(state: AvailabilityResetState, now: Date): AvailabilityResetAction {
  const stale = state.hasAvailability && isOverdue(state.availabilitySince, INACTIVITY_WARNING_DAYS.stale_availability, now)

  if (stale && noticeElapsed(state.warnedAt, now)) return 'reset'
  if (state.inInactivityScope) return null
  if (stale && state.warnedAt === null) return 'warn'
  if (!stale && state.warnedAt !== null) return 'clear'
  return null
}
