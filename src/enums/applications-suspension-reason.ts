import type { SuspensionReason } from '~/server/bailleur/inactivity-rules'

export const SUSPENSION_REASON_LABELS: Record<SuspensionReason, string> = {
  manual: 'Mise en pause par le gestionnaire',
  unprocessed_applications: 'Suspension automatique : candidatures non traitées',
  stale_availability: 'Suspension automatique : disponibilités non mises à jour',
}
