'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import styles from '~/app/(authenticated)/administration/administration.module.css'
import type { TImportJobStatus } from '~/schemas/import-jobs'
import { useTRPC } from '~/server/trpc/client'
import { StatusBadge } from './status-badge'

function formatDate(date: string | Date) {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: fr })
}

function summaryText(summary: unknown): { owner: string | null; stats: string | null } {
  const s = summary as Record<string, unknown> | null
  if (!s) return { owner: null, stats: null }

  const owner = typeof s.ownerName === 'string' ? s.ownerName : null
  const parts: string[] = []
  if (s.created) parts.push(`${s.created} créée(s)`)
  if (s.updated) parts.push(`${s.updated} mise(s) à jour`)
  const errors = Array.isArray(s.errors) ? s.errors.length : 0
  if (errors) parts.push(`${errors} erreur(s)`)
  return { owner, stats: parts.length > 0 ? parts.join(' · ') : null }
}

export function JobHistoryList() {
  const trpc = useTRPC()
  const { data: jobs, isLoading } = useQuery(trpc.admin.imports.list.queryOptions())

  if (isLoading) {
    return <div className="fr-p-3w fr-text-mention--grey">Chargement...</div>
  }

  if (!jobs?.length) {
    return <div className="fr-p-3w fr-text-mention--grey fr-text--center">Aucun import pour le moment.</div>
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Historique</span>
      </div>
      {jobs.map((job) => {
        const { owner, stats } = summaryText(job.summary)
        const errorCount = Array.isArray((job.summary as Record<string, unknown> | null)?.errors)
          ? ((job.summary as { errors: unknown[] }).errors.length ?? 0)
          : 0
        return (
          <div key={job.id} className={clsx(styles.activityItem, 'fr-align-items-center')}>
            <span className={clsx('fr-icon-file-text-line', styles.activityIcon)} aria-hidden="true" />
            <div className={styles.activityText}>
              <div className="fr-text--bold">
                {owner ?? job.source ?? `Import #${job.id}`}
                {owner && job.source && <span className="fr-text--regular fr-text-mention--grey fr-text--sm">{` · ${job.source}`}</span>}
              </div>
              <div className="fr-text-mention--grey fr-text--sm fr-mt-1v">
                {formatDate(job.createdAt)}
                {stats && ` · ${stats}`}
              </div>
            </div>
            <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
              <StatusBadge status={job.status as TImportJobStatus} errorCount={errorCount} />
              <Button
                priority="tertiary"
                size="small"
                iconId="fr-icon-arrow-right-line"
                iconPosition="right"
                linkProps={{ href: `/administration/imports/${job.id}` }}
              >
                Détail
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
