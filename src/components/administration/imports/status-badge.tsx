import Badge from '@codegouvfr/react-dsfr/Badge'
import type { TImportJobStatus } from '~/schemas/import-jobs'

export function StatusBadge({ status, errorCount }: { status: TImportJobStatus; errorCount: number }) {
  if (status === 'error') return <Badge severity="error">Erreur</Badge>
  if (status === 'done' && errorCount > 0) return <Badge severity="warning">Terminé avec erreurs</Badge>
  if (status === 'done') return <Badge severity="success">Terminé</Badge>
  return <Badge severity="info">En cours</Badge>
}
