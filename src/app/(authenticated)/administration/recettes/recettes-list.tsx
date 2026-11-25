'use client'

import Accordion from '@codegouvfr/react-dsfr/Accordion'
import Badge from '@codegouvfr/react-dsfr/Badge'
import { useAdminRecettes } from '~/hooks/use-admin-recettes'
import { formatDateTime } from '~/utils/formatDate'

const STATUS_LABELS: Record<string, { label: string; severity: 'success' | 'error' | 'warning' | 'info' }> = {
  expected: { label: 'Réussi', severity: 'success' },
  unexpected: { label: 'Échoué', severity: 'error' },
  flaky: { label: 'Instable', severity: 'warning' },
  skipped: { label: 'Ignoré', severity: 'info' },
}

const formatDuration = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`

export const RecettesList = () => {
  const { data: reports, isLoading, isError } = useAdminRecettes()

  if (isLoading) return <p>Chargement…</p>
  if (isError) return <p className="fr-text--sm">Impossible de récupérer les recettes depuis le stockage. Réessayez plus tard.</p>
  if (!reports || reports.length === 0) return <p className="fr-text--sm">Aucune recette déposée pour le moment.</p>

  return (
    <>
      {reports.map((report) => (
        <Accordion
          key={report.id}
          label={
            <span className="fr-flex fr-flex-wrap fr-align-items-center" style={{ gap: '0.5rem' }}>
              {formatDateTime(new Date(report.runAt))}
              <Badge severity={report.stats.failed > 0 ? 'error' : 'success'} small as="span">
                {report.stats.failed > 0 ? `${report.stats.failed} échec(s)` : `${report.stats.passed} tests réussis`}
              </Badge>
              <span className="fr-text--xs fr-text-mention--grey">
                {report.target} · {formatDuration(report.durationMs)}
              </span>
            </span>
          }
        >
          <ul className="fr-raw-list">
            {report.tests.map((test) => {
              const status = STATUS_LABELS[test.status] ?? { label: test.status, severity: 'info' as const }
              return (
                <li key={`${test.file}-${test.title}`} className="fr-mb-3w">
                  <p className="fr-text--bold fr-mb-1v">
                    {test.title}
                    <Badge severity={status.severity} small as="span" className="fr-ml-1w">
                      {status.label}
                    </Badge>
                    <span className="fr-text--xs fr-text-mention--grey fr-ml-1w">{formatDuration(test.durationMs)}</span>
                  </p>
                  {test.videoUrl ? (
                    <video controls muted preload="none" src={test.videoUrl} style={{ width: '100%', maxWidth: '640px' }} />
                  ) : (
                    <p className="fr-text--xs fr-text-mention--grey fr-mb-0">Pas de vidéo pour ce test.</p>
                  )}
                </li>
              )
            })}
          </ul>
        </Accordion>
      ))}
    </>
  )
}
