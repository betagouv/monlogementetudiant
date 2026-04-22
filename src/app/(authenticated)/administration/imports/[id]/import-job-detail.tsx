'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import Link from 'next/link'
import styles from '~/app/(authenticated)/administration/administration.module.css'
import { JobSummary } from '~/components/administration/imports/job-summary'
import type { TImportJobStatus, TImportJobSummary } from '~/schemas/import-jobs'
import { useTRPC } from '~/server/trpc/client'

export function ImportJobDetail({ id }: { id: string }) {
  const trpc = useTRPC()
  const jobId = Number(id)

  const { data: job, isLoading } = useQuery(trpc.admin.imports.getById.queryOptions({ id: jobId }))

  if (isLoading) {
    return <div className="fr-p-3w fr-text-mention--grey">Chargement...</div>
  }

  if (!job) {
    return <div className="fr-p-3w fr-text-default-error">Import introuvable.</div>
  }

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-2v">
          <Link href="/administration/imports">
            <Button priority="tertiary" size="small" iconId="fr-icon-arrow-left-line">
              Imports
            </Button>
          </Link>
        </div>
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-file-text-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Import CSV{job.source && ` — ${job.source}`}</h1>
        </div>
      </div>

      <div className={styles.card}>
        <div className="fr-p-3w">
          <JobSummary
            job={{
              id: job.id,
              status: job.status as TImportJobStatus,
              source: job.source,
              createdAt: job.createdAt,
              summary: job.summary as TImportJobSummary,
            }}
          />
        </div>
      </div>
    </>
  )
}
