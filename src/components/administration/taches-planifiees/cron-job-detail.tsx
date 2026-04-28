'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import Link from 'next/link'
import styles from '~/app/(authenticated)/administration/administration.module.css'
import type { TImportJobResidence, TImportJobStatus, TImportJobSummary } from '~/schemas/import-jobs'
import { useTRPC } from '~/server/trpc/client'
import { StatusBadge } from '../imports/status-badge'
import { JobDuration } from '../shared/job-duration'
import { JobStatCards } from '../shared/job-stat-cards'
import { isImportJob, JOB_LABELS } from './cron-job-defs'

function ContextPanel({ context }: { context: Record<string, unknown> }) {
  const entries = Object.entries(context)
  if (!entries.length) return null

  const labels: Record<string, string> = {
    anneeUniversitaire: 'Année universitaire',
    enregistrementsTelecharges: 'Enregistrements téléchargés',
    dateDebut: 'Date de début',
    dateFin: 'Date de fin',
    nbJours: 'Jours traités',
  }

  return (
    <div className={clsx(styles.card, 'fr-mt-3w')}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Contexte</span>
      </div>
      <div className="fr-p-3w" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1.5rem' }}>
        {entries.map(([key, value]) => (
          <>
            <div key={`label-${key}`} className="fr-text--sm fr-text-mention--grey" style={{ fontWeight: 600 }}>
              {labels[key] ?? key}
            </div>
            <div key={`value-${key}`} className="fr-text--sm">
              {String(value)}
            </div>
          </>
        ))}
      </div>
    </div>
  )
}

function ResidencesTable({ residences }: { residences: TImportJobResidence[] }) {
  return (
    <div className={clsx(styles.card, 'fr-mt-3w')}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Résidences traitées</span>
        <span className="fr-text-mention--grey fr-text--sm">
          {residences.length} résidence{residences.length > 1 ? 's' : ''}
        </span>
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

export function CronJobDetail({ id }: { id: string }) {
  const trpc = useTRPC()
  const { data: job, isLoading } = useQuery(trpc.admin.imports.getById.queryOptions({ id: Number(id) }))

  if (isLoading) return <div className="fr-p-3w fr-text-mention--grey">Chargement…</div>
  if (!job) return <div className="fr-p-3w fr-text-default-error">Tâche introuvable.</div>

  const summary = job.summary as TImportJobSummary | null
  const context = summary?.context as Record<string, unknown> | undefined
  const residences = summary?.residences ?? []
  const label = (JOB_LABELS as Record<string, string>)[job.type] ?? job.type
  const isImport = isImportJob(job.type)

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-2v">
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
          <h1 className="fr-h3 fr-mb-0">{label}</h1>
        </div>
      </div>

      <div className={styles.card}>
        <div className="fr-p-3w">
          <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-3w">
            <StatusBadge status={job.status as TImportJobStatus} errorCount={summary?.errors?.length ?? 0} />
            <span className="fr-text-mention--grey">{format(new Date(job.createdAt), 'd MMMM yyyy à HH:mm', { locale: fr })}</span>
            <JobDuration startedAt={job.startedAt} endedAt={job.endedAt} className="fr-text-mention--grey" />
          </div>

          {summary && (
            <JobStatCards
              created={isImport ? summary.created : undefined}
              updated={summary.updated}
              skipped={summary.skipped}
              errors={summary.errors}
              labels={{
                created: 'Créées',
                updated: isImport ? 'Mises à jour' : 'Mis à jour',
                skipped: 'Ignorés',
              }}
            />
          )}
        </div>
      </div>

      {context && Object.keys(context).length > 0 && <ContextPanel context={context} />}

      {(summary?.errors?.length ?? 0) > 0 && (
        <div className={clsx(styles.card, 'fr-mt-3w')}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Erreurs</span>
          </div>
          <div className="fr-p-3w">
            <ul className={clsx('fr-text--sm', styles.errorList)}>
              {summary!.errors!.map((e, i) => (
                <li key={i} className="fr-text-default-error fr-mb-1v">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {isImport && residences.length > 0 && <ResidencesTable residences={residences} />}
    </>
  )
}
