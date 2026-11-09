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

export const formatDateTime = (value: Date | string) =>
  new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const formatDelay = (seconds: number | null) => {
  if (seconds === null) return '—'
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} j`
}
