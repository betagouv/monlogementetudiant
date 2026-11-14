import Badge from '@codegouvfr/react-dsfr/Badge'

const STATUS_BADGES = {
  running: { severity: 'info', label: 'En cours' },
  done: { severity: 'success', label: 'Terminé' },
  error: { severity: 'error', label: 'Erreur' },
  interrupted: { severity: 'warning', label: 'Interrompu' },
} as const

export function JobRunStatusBadge({ status, errorCount = 0 }: { status: string; errorCount?: number }) {
  if (status === 'done' && errorCount > 0) {
    return (
      <Badge severity="warning" small>
        Terminé avec erreurs
      </Badge>
    )
  }
  const badge = STATUS_BADGES[status as keyof typeof STATUS_BADGES] ?? { severity: 'info', label: status }
  return (
    <Badge severity={badge.severity} small>
      {badge.label}
    </Badge>
  )
}

const METRIC_LABELS: Record<string, string> = {
  created: 'créées',
  updated: 'mises à jour',
  skipped: 'ignorées',
  deleted: 'supprimées',
  anonymized: 'anonymisées',
  dossiersPurged: 'dossiers purgés',
  errors: 'erreurs',
  emails: 'e-mails',
  housings: 'logements',
  failed: 'en échec',
  triggered: 'hausses détectées',
  jobsCreated: 'envois créés',
}

export function formatMetrics(metrics: Record<string, number>): string {
  return Object.entries(metrics)
    .map(([key, value]) => `${value} ${METRIC_LABELS[key] ?? key}`)
    .join(', ')
}
