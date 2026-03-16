import Badge from '@codegouvfr/react-dsfr/Badge'

const STATUS_CONFIG = {
  pending: { label: 'A modérer', severity: 'new' },
  accepted: { label: 'Accepté', severity: 'success' },
  rejected: { label: 'Refusé', severity: 'error' },
} as const

export const CandidatureDetailSuivi = ({ status }: { status: string }) => {
  const statusConfig = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending

  return (
    <>
      <h2 className="fr-h4 fr-mb-2w">Statut de la candidature</h2>
      <div className="fr-mb-4w">
        <Badge severity={statusConfig.severity} noIcon>
          {statusConfig.label}
        </Badge>
      </div>
    </>
  )
}
