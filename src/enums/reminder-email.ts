import { z } from 'zod'
import type { InactivityReason } from '~/server/bailleur/inactivity-rules'

export enum EReminderType {
  AVAILABILITY_MONTHLY_RECAP = 'availability_monthly_recap',
  AVAILABILITY_RESET_WARNING = 'availability_reset_warning',
  AVAILABILITY_RESET_DONE = 'availability_reset_done',
  APPLICATIONS_INACTIVITY_WARNING = 'applications_inactivity_warning',
  APPLICATIONS_AUTO_SUSPENDED = 'applications_auto_suspended',
}

export const ZReminderType = z.enum(EReminderType)

export const REMINDER_TYPE_LABELS: Record<EReminderType, string> = {
  [EReminderType.AVAILABILITY_MONTHLY_RECAP]: 'Récap mensuel des disponibilités',
  [EReminderType.AVAILABILITY_RESET_WARNING]: 'Alerte disponibilités périmées',
  [EReminderType.AVAILABILITY_RESET_DONE]: 'Disponibilités repassées en « non communiquée »',
  [EReminderType.APPLICATIONS_INACTIVITY_WARNING]: "Alerte d'inactivité",
  [EReminderType.APPLICATIONS_AUTO_SUSPENDED]: 'Suspension automatique des candidatures',
}

export const MEASURED_REMINDER_TYPES: EReminderType[] = [
  EReminderType.AVAILABILITY_MONTHLY_RECAP,
  EReminderType.AVAILABILITY_RESET_WARNING,
  EReminderType.APPLICATIONS_INACTIVITY_WARNING,
]

export const REMINDER_TAGS: Record<EReminderType, string> = {
  [EReminderType.AVAILABILITY_MONTHLY_RECAP]: 'relance-recap-dispos',
  [EReminderType.AVAILABILITY_RESET_WARNING]: 'relance-alerte-dispos',
  [EReminderType.AVAILABILITY_RESET_DONE]: 'relance-remise-a-zero-dispos',
  [EReminderType.APPLICATIONS_INACTIVITY_WARNING]: 'relance-alerte-inactivite',
  [EReminderType.APPLICATIONS_AUTO_SUSPENDED]: 'relance-suspension-candidatures',
}

export const REASON_TAGS: Record<InactivityReason, string> = {
  unprocessed_applications: 'motif-candidatures',
  stale_availability: 'motif-dispos',
}
