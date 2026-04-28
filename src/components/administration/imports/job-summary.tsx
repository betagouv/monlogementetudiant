'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import styles from '~/app/(authenticated)/administration/administration.module.css'
import type { TImportJobResidence, TImportJobStatus, TImportJobSummary } from '~/schemas/import-jobs'
import { JobDuration } from '../shared/job-duration'
import { JobStatCards } from '../shared/job-stat-cards'
import { StatusBadge } from './status-badge'

type Job = {
  id: number
  status: TImportJobStatus
  source: string | null
  createdAt: Date
  startedAt?: Date | null
  endedAt?: Date | null
  summary: TImportJobSummary | null
}

function ResidencesTable({ residences }: { residences: TImportJobResidence[] }) {
  return (
    <div className={clsx(styles.card, 'fr-mt-3w')}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Résidences importées</span>
        <span className="fr-text-mention--grey fr-text--sm">{residences.length} résidence(s)</span>
      </div>
      <div className={clsx('fr-table', styles.tableWrapper)}>
        <table>
          <thead>
            <tr>
              <th scope="col">Résidence</th>
              <th scope="col">Ville</th>
              <th scope="col">Action</th>
              <th scope="col">Gérer</th>
            </tr>
          </thead>
          <tbody>
            {residences.map((r) => (
              <tr key={r.slug}>
                <td className="fr-text--bold">{r.name}</td>
                <td>{r.city ?? '—'}</td>
                <td>
                  {r.action === 'created' ? (
                    <Badge severity="success" noIcon small>
                      Créée
                    </Badge>
                  ) : (
                    <Badge severity="info" noIcon small>
                      Mise à jour
                    </Badge>
                  )}
                </td>
                <td>
                  <Button
                    priority="tertiary"
                    size="small"
                    linkProps={{ href: `/bailleur/residences/${r.slug}` }}
                    iconId="fr-icon-edit-line"
                  >
                    Modifier
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function JobSummary({ job }: { job: Job }) {
  const summary = job.summary
  const residences = summary?.residences ?? []

  return (
    <div>
      <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-3w">
        <StatusBadge status={job.status} errorCount={summary?.errors?.length ?? 0} />
        {job.source && <span className="fr-text-mention--grey">Source : {job.source}</span>}
        <span className="fr-text-mention--grey">{format(new Date(job.createdAt), 'd MMMM yyyy à HH:mm', { locale: fr })}</span>
        <JobDuration startedAt={job.startedAt} endedAt={job.endedAt} className="fr-text-mention--grey" />
      </div>

      {summary && (
        <>
          <JobStatCards
            created={summary.created}
            updated={summary.updated}
            errors={summary.errors}
            labels={{ created: 'Créées', updated: 'Mises à jour' }}
          />

          {summary.ownerId && summary.ownerName && (
            <div className="fr-mt-3w">
              <Button
                priority="primary"
                linkProps={{ href: `/administration/bailleurs/${summary.ownerId}` }}
                iconId="fr-icon-building-line"
              >
                Gérer {summary.ownerName}
              </Button>
            </div>
          )}

          {(summary.errors?.length ?? 0) > 0 && (
            <div className={clsx(styles.card, 'fr-mt-3w')}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Erreurs</span>
              </div>
              <div className="fr-p-3w">
                <ul className={clsx('fr-text--sm', styles.errorList)}>
                  {summary.errors!.map((e, i) => (
                    <li key={i} className="fr-text-default-error fr-mb-1v">
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {residences.length > 0 && <ResidencesTable residences={residences} />}
        </>
      )}
    </div>
  )
}
