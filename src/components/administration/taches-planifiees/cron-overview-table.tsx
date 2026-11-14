'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import styles from '~/app/(authenticated)/administration/administration.module.css'
import { useTRPC } from '~/server/trpc/client'
import { JobDuration } from '../shared/job-duration'
import { describeCron, formatParisDateTime, getJobDef } from './cron-job-defs'
import { formatMetrics, JobRunStatusBadge } from './job-run-status-badge'

const formatDate = formatParisDateTime

export function CronOverviewTable() {
  const trpc = useTRPC()
  const { data: rows, isLoading } = useQuery(trpc.admin.jobRuns.overview.queryOptions())

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Vue d'ensemble</span>
        <span className="fr-text-mention--grey fr-text--sm">{rows?.length ?? 0} tâches</span>
      </div>
      <div className={clsx('fr-table', styles.tableWrapper)}>
        <table>
          <thead>
            <tr>
              <th scope="col">Tâche</th>
              <th scope="col">Planification</th>
              <th scope="col">Dernière exécution</th>
              <th scope="col">Durée</th>
              <th scope="col">Statut</th>
              <th scope="col">Compteurs</th>
              <th scope="col">Prochaine exécution</th>
              <th scope="col">Détail</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="fr-text-mention--grey">
                  Chargement…
                </td>
              </tr>
            )}
            {rows?.map(({ identifier, cron, nextRunAt, last }) => {
              const def = getJobDef(identifier)
              const metrics = last ? formatMetrics(last.metrics) : ''

              return (
                <tr key={identifier}>
                  <td>
                    <div className="fr-text--bold">{def.label}</div>
                    <div className="fr-text-mention--grey fr-text--sm">{def.description}</div>
                  </td>
                  <td className="fr-text--sm fr-text-mention--grey">{cron ? describeCron(cron) : 'Déclenchée par événement'}</td>
                  <td className="fr-text--sm">
                    {last ? formatDate(last.startedAt) : <span className="fr-text-mention--grey">Jamais</span>}
                  </td>
                  <td className="fr-text--sm fr-text-mention--grey">
                    {last ? <JobDuration startedAt={last.startedAt} endedAt={last.endedAt} /> : '—'}
                  </td>
                  <td>
                    {last ? (
                      <JobRunStatusBadge status={last.status} errorCount={last.metrics.errors ?? 0} />
                    ) : (
                      <span className="fr-text-mention--grey">—</span>
                    )}
                  </td>
                  <td className="fr-text--sm">{metrics || <span className="fr-text-mention--grey">—</span>}</td>
                  <td className="fr-text--sm fr-text-mention--grey">{nextRunAt ? formatDate(nextRunAt) : '—'}</td>
                  <td>
                    <div className="fr-flex fr-flex-gap-2v">
                      <Button
                        priority="tertiary"
                        size="small"
                        iconId="fr-icon-arrow-right-line"
                        iconPosition="right"
                        linkProps={{ href: `/administration/taches-planifiees/tache/${identifier}` }}
                      >
                        Historique
                      </Button>
                      {last?.source === 'import_job' && last.importJobId !== undefined && (
                        <Button
                          priority="tertiary no outline"
                          size="small"
                          linkProps={{ href: `/administration/taches-planifiees/${last.importJobId}` }}
                        >
                          Dernier import
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
