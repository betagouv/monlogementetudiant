import type { TReminderEfficacyStatus } from '~/server/reminders/reminder-efficacy'
import type { TBlockedReason, TBrevoEmailStatus } from '~/server/services/brevo-reminders'

export const EMAIL_STATUS_LABELS: Record<TBrevoEmailStatus, string> = {
  sent: 'Envoyé',
  deferred: 'Différé',
  delivered: 'Délivré',
  opened: 'Ouvert',
  clicked: 'Cliqué',
  bounced: 'Rejeté',
  blocked: 'Bloqué',
  error: 'Erreur',
}

export const EFFICACY_LABELS: Record<TReminderEfficacyStatus, string> = {
  effective: 'Efficace',
  failed: 'En échec',
  pending: 'En cours',
  not_measured: '—',
}

export const BLOCKED_REASON_LABELS: Record<TBlockedReason, string> = {
  unsubscribedViaEmail: "Désabonné via l'e-mail",
  unsubscribedViaMA: 'Désabonné via une automation',
  unsubscribedViaApi: "Désabonné via l'API",
  adminBlocked: 'Bloqué manuellement',
  hardBounce: 'Adresse invalide (rejet définitif)',
  contactFlaggedAsSpam: 'Signalé comme spam',
}

export const BLOCKED_REASON_CODES = Object.keys(BLOCKED_REASON_LABELS) as TBlockedReason[]
