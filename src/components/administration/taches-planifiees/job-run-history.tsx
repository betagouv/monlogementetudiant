'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import { useState } from 'react'
import styles from '~/app/(authenticated)/administration/administration.module.css'
import { Pagination } from '~/components/ui/pagination'
import { useTRPC } from '~/server/trpc/client'
import { JobDuration } from '../shared/job-duration'
import { describeCron, getJobDef, SCHEDULED_JOBS } from './cron-job-defs'
import { formatMetrics, JobRunStatusBadge } from './job-run-status-badge'

const TRIGGER_LABELS = { scheduled: 'Planifiée', event: 'Événement', manual: 'Manuelle' } as const

export function JobRunHistory({ identifier }: { identifier: string }) {
  const trpc = useTRPC()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery(trpc.admin.jobRuns.history.queryOptions({ identifier, page }))
  const def = getJobDef(identifier)
  const cron = SCHEDULED_JOBS.find((job) => job.identifier === identifier)?.cron

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-mb-2v">
          <Link href="/administration/taches-planifiees">
            <Button priority="tertiary" size="small" iconId="fr-icon-arrow-left-line">
              Tâches planifiées
            </Button>
          </Link>
        </div>
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-time-line')} aria-hidden="true" />
          </div>
          <div>
            <h1 className="fr-h3 fr-mb-0">{def.label}</h1>
            {cron && <p className="fr-text-mention--grey fr-text--sm fr-mb-0">{describeCron(cron)}</p>}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Historique des exécutions</span>
          <span className="fr-text-mention--grey fr-text--sm">{data?.total ?? 0} exécutions</span>
        </div>
        <div className={clsx('fr-table', styles.tableWrapper)}>
          <table>
            <thead>
              <tr>
                <th scope="col">Début</th>
                <th scope="col">Déclenchement</th>
                <th scope="col">Durée</th>
                <th scope="col">Statut</th>
                <th scope="col">Compteurs</th>
                <th scope="col">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="fr-text-mention--grey">
                    Chargement…
                  </td>
                </tr>
              )}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="fr-text-mention--grey">
                    Aucune exécution enregistrée.
                  </td>
                </tr>
              )}
              {data?.items.map((run) => (
                <tr key={run.id}>
                  <td className="fr-text--sm">{format(new Date(run.startedAt), 'd MMM yyyy HH:mm:ss', { locale: fr })}</td>
                  <td className="fr-text--sm">{TRIGGER_LABELS[run.trigger]}</td>
                  <td className="fr-text--sm fr-text-mention--grey">
                    <JobDuration startedAt={run.startedAt} endedAt={run.endedAt} />
                  </td>
                  <td>
                    <JobRunStatusBadge status={run.status} />
                  </td>
                  <td className="fr-text--sm">{formatMetrics(run.metrics) || '—'}</td>
                  <td className="fr-text--sm fr-text-default-error">{run.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(data?.pageCount ?? 0) > 1 && (
        <Pagination
          className="fr-flex fr-justify-content-center fr-mt-3w"
          count={data!.pageCount}
          defaultPage={page}
          getPageLinkProps={(pageNumber) => ({
            href: '#',
            onClick: (e) => {
              e.preventDefault()
              setPage(pageNumber)
            },
          })}
        />
      )}
    </>
  )
}
