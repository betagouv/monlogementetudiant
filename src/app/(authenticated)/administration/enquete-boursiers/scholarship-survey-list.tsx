'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import Notice from '@codegouvfr/react-dsfr/Notice'
import Select from '@codegouvfr/react-dsfr/SelectNext'
import type { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { useAdminScholarshipSurveyList, useAdminScholarshipSurveyStats } from '~/hooks/use-admin-scholarship-survey'
import type { SurveyAdminRow } from '~/server/scholarship-survey/admin'
import { formatDateTime } from '~/utils/formatDate'
import styles from '../administration.module.css'

const STATUSES = ['all', 'answered', 'unanswered'] as const

const statusOptions = [
  { value: 'all', label: 'Toutes les résidences' },
  { value: 'answered', label: 'Répondues' },
  { value: 'unanswered', label: 'Sans réponse' },
]

const dash = <span className="fr-text-mention--grey">-</span>

const columns: ColumnDef<SurveyAdminRow, unknown>[] = [
  {
    accessorKey: 'ownerName',
    header: 'Bailleur',
    enableSorting: false,
    cell: ({ row }) => (
      <div>
        <div>{row.original.ownerName}</div>
        <div className="fr-text--xs fr-text-mention--grey">
          {row.original.ownerCompletedAt ? `Complétée le ${formatDateTime(row.original.ownerCompletedAt)}` : 'Non complétée'}
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'accommodationName',
    header: 'Résidence',
    enableSorting: false,
    cell: ({ row }) => (
      <div>
        <div className="fr-text--bold">{row.original.accommodationName}</div>
        {row.original.city && <div className="fr-text--xs fr-text-mention--grey">{row.original.city}</div>}
      </div>
    ),
  },
  {
    accessorKey: 'scholarshipCount',
    header: 'Nombre',
    enableSorting: false,
    cell: ({ row }) => row.original.scholarshipCount ?? dash,
  },
  {
    accessorKey: 'scholarshipRate',
    header: 'Part (%)',
    enableSorting: false,
    cell: ({ row }) => (row.original.scholarshipRate !== null ? `${row.original.scholarshipRate} %` : dash),
  },
  {
    accessorKey: 'notMeasured',
    header: 'Non mesuré',
    enableSorting: false,
    cell: ({ row }) => (row.original.notMeasured ? 'Oui' : dash),
  },
  {
    accessorKey: 'updatedAt',
    header: 'Dernière mise à jour',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.updatedAt ? (
        <div>
          <div>{formatDateTime(row.original.updatedAt)}</div>
          {row.original.updatedBy && <div className="fr-text--xs fr-text-mention--grey">{row.original.updatedBy}</div>}
        </div>
      ) : (
        dash
      ),
  },
]

export function ScholarshipSurveyList() {
  const [{ status, search, page }, setQueryStates] = useQueryStates({
    status: parseAsStringLiteral(STATUSES).withDefault('all'),
    search: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
  })

  const { data: stats } = useAdminScholarshipSurveyStats()
  const { data, isLoading } = useAdminScholarshipSurveyList({ status, search: search || undefined, page })

  const exportParams = new URLSearchParams({ status, ...(search ? { search } : {}) })

  return (
    <>
      <div className="fr-mb-3w fr-flex fr-justify-content-space-between fr-align-items-center fr-flex-wrap fr-flex-gap-2v">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-survey-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Enquête flash : part d'étudiants boursiers</h1>
        </div>
        <Button
          iconId="fr-icon-download-line"
          priority="secondary"
          linkProps={{ href: `/api/admin/enquete-boursiers/export?${exportParams}` }}
        >
          Exporter en CSV
        </Button>
      </div>

      <Notice className="fr-mb-3w" title="Les logements CROUS ne sont pas pris en compte dans cette enquête." />

      <div className={clsx(styles.statsGrid, 'fr-mb-3w')}>
        <div className={clsx(styles.statCard, styles.statCardBlue)}>
          <div className={styles.statLabel}>Bailleurs ayant complété</div>
          <div className={styles.statValue}>
            {stats?.ownersCompleted ?? 0} / {stats?.ownersTotal ?? 0}
          </div>
        </div>
        <div className={clsx(styles.statCard, styles.statCardGreen)}>
          <div className={styles.statLabel}>Résidences renseignées</div>
          <div className={styles.statValue}>
            {stats?.residencesFilled ?? 0} / {stats?.residencesTotal ?? 0}
          </div>
        </div>
      </div>

      <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w fr-align-items-end">
        <div className="fr-col-12 fr-col-md-4">
          <Select
            label="Statut"
            nativeSelectProps={{
              value: status,
              onChange: (e) => setQueryStates({ status: STATUSES.find((s) => s === e.target.value) ?? 'all', page: 1 }),
            }}
            options={statusOptions}
          />
        </div>
        <div className="fr-col-12 fr-col-md-4">
          <Input
            label="Rechercher un bailleur ou une résidence"
            nativeInputProps={{
              type: 'search',
              value: search,
              onChange: (e) => setQueryStates({ search: e.target.value, page: 1 }),
            }}
          />
        </div>
      </div>

      <AdminDataTable
        columns={columns}
        data={data?.rows ?? []}
        pageCount={data?.pageCount ?? 0}
        page={page}
        onPageChange={(p) => setQueryStates({ page: p })}
        isLoading={isLoading}
      />
    </>
  )
}
