'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import styles from '~/app/(authenticated)/administration/administration.module.css'
import type { TImportJobStatus, TImportJobSummary } from '~/schemas/import-jobs'
import { useTRPC } from '~/server/trpc/client'
import { StatusBadge } from '../imports/status-badge'
import { JobDuration } from '../shared/job-duration'
import { CRON_JOB_DEFS, isImportJob } from './cron-job-defs'

function impactedCount(summary: TImportJobSummary | null): number | null {
  if (!summary) return null
  return (summary.created ?? 0) + (summary.updated ?? 0)
}

function impactedLabel(type: string, count: number): string {
  if (isImportJob(type)) return `${count} résidence${count > 1 ? 's' : ''}`
  if (type === 'sync-stats') return `${count} jour${count > 1 ? 's' : ''}`
  return `${count} entrée${count > 1 ? 's' : ''}`
}

export function CronOverviewTable() {
  const trpc = useTRPC()
  const { data: lastJobs, isLoading } = useQuery(trpc.admin.imports.lastByType.queryOptions())

  const lastByType = new Map(lastJobs?.map((j) => [j.type, j]) ?? [])

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Vue d'ensemble</span>
        <span className="fr-text-mention--grey fr-text--sm">{CRON_JOB_DEFS.length} tâches planifiées</span>
      </div>
      <div className={clsx('fr-table', styles.tableWrapper)}>
        <table>
          <thead>
            <tr>
              <th scope="col">Tâche</th>
              <th scope="col">Planification</th>
              <th scope="col">Dernier run</th>
              <th scope="col">Durée</th>
              <th scope="col">Impact</th>
              <th scope="col">Statut</th>
              <th scope="col">Détail</th>
            </tr>
          </thead>
          <tbody>
            {CRON_JOB_DEFS.map((cron) => {
              const job = lastByType.get(cron.type)
              const summary = (job?.summary as TImportJobSummary | null) ?? null
              const errorCount = summary?.errors?.length ?? 0
              const count = job ? impactedCount(summary) : null

              return (
                <tr key={cron.type}>
                  <td>
                    <div className="fr-text--bold">{cron.label}</div>
                    <div className="fr-text-mention--grey fr-text--sm">{cron.description}</div>
                  </td>
                  <td className="fr-text--sm fr-text-mention--grey">{cron.schedule}</td>
                  <td className="fr-text--sm">
                    {isLoading ? (
                      <span className="fr-text-mention--grey">…</span>
                    ) : job ? (
                      format(new Date(job.createdAt), 'd MMM yyyy HH:mm', { locale: fr })
                    ) : (
                      <span className="fr-text-mention--grey">Jamais</span>
                    )}
                  </td>
                  <td className="fr-text--sm fr-text-mention--grey">
                    {job ? <JobDuration startedAt={job.startedAt} endedAt={job.endedAt} /> : '—'}
                  </td>
                  <td className="fr-text--sm">
                    {count !== null ? <span>{impactedLabel(cron.type, count)}</span> : <span className="fr-text-mention--grey">—</span>}
                  </td>
                  <td>
                    {isLoading ? null : job ? (
                      <StatusBadge status={job.status as TImportJobStatus} errorCount={errorCount} />
                    ) : (
                      <Badge severity="info" noIcon small>
                        Jamais exécuté
                      </Badge>
                    )}
                  </td>
                  <td>
                    {job && (
                      <Button
                        priority="tertiary"
                        size="small"
                        iconId="fr-icon-arrow-right-line"
                        iconPosition="right"
                        linkProps={{ href: `/administration/taches-planifiees/${job.id}` }}
                      >
                        Voir
                      </Button>
                    )}
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
