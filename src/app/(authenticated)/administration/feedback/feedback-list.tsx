'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/SelectNext'
import { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { useAdminFeedbackList, useAdminFeedbackStats } from '~/hooks/use-admin-feedback'
import { formatDateTime } from '~/utils/formatDate'
import { sPluriel } from '~/utils/sPluriel'
import styles from '../administration.module.css'

type FeedbackRow = {
  id: string
  rating: number | null
  comment: string | null
  createdAt: Date
  userId: string
  userEmail: string
  userFirstname: string
  userLastname: string
  ownerName: string | null
  bailleurRole: 'administrator' | 'gestionnaire' | null
}

const bailleurRoleLabel = (role: FeedbackRow['bailleurRole']): string => {
  if (role === 'administrator') return 'Administrateur'
  if (role === 'gestionnaire') return 'Gestionnaire'
  return '-'
}

const columns: ColumnDef<FeedbackRow, unknown>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Date',
    enableSorting: false,
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  },
  {
    accessorKey: 'rating',
    header: 'Note',
    enableSorting: false,
    cell: ({ row }) => (row.original.rating ? <strong>{row.original.rating} / 5</strong> : '-'),
  },
  {
    accessorKey: 'userEmail',
    header: 'Utilisateur',
    enableSorting: false,
    cell: ({ row }) => (
      <div>
        <div className="fr-text--bold">
          {row.original.userFirstname} {row.original.userLastname}
        </div>
        <div className="fr-text--xs fr-text-mention--grey">{row.original.userEmail}</div>
      </div>
    ),
  },
  {
    accessorKey: 'ownerName',
    header: 'Bailleur',
    enableSorting: false,
    cell: ({ row }) => (
      <div>
        <div>{row.original.ownerName ?? '-'}</div>
        <div className="fr-text--xs fr-text-mention--grey">{bailleurRoleLabel(row.original.bailleurRole)}</div>
      </div>
    ),
  },
  {
    accessorKey: 'comment',
    header: 'Commentaire',
    enableSorting: false,
    cell: ({ row }) => (row.original.comment ? <span>{row.original.comment}</span> : <span className="fr-text-mention--grey">-</span>),
  },
]

const ratingOptions = [
  { value: '', label: 'Toutes les notes' },
  { value: '1', label: '1 étoile' },
  { value: '2', label: '2 étoiles' },
  { value: '3', label: '3 étoiles' },
  { value: '4', label: '4 étoiles' },
  { value: '5', label: '5 étoiles' },
]

export function FeedbackList() {
  const [{ from, to, rating, page }, setQueryStates] = useQueryStates({
    from: parseAsString.withDefault(''),
    to: parseAsString.withDefault(''),
    rating: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
  })

  const filters = {
    from: from || undefined,
    to: to || undefined,
    rating: rating ? Number(rating) : undefined,
  }

  const { data: stats } = useAdminFeedbackStats({ from: filters.from, to: filters.to })
  const { data, isLoading } = useAdminFeedbackList({ page, ...filters })

  const total = data?.total ?? 0
  const averageDisplay = stats?.average != null ? stats.average.toFixed(2) : '-'

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-questionnaire-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Feedback gestionnaires</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">
          {total} retour{sPluriel(total)} sur la période sélectionnée
        </p>
      </div>

      <div className={clsx(styles.statsGrid, 'fr-mb-3w')}>
        <div className={clsx(styles.statCard, styles.statCardBlue)}>
          <div className={styles.statLabel}>Note moyenne</div>
          <div className={styles.statValue}>{averageDisplay}</div>
        </div>
        <div className={clsx(styles.statCard, styles.statCardGreen)}>
          <div className={styles.statLabel}>Réponses</div>
          <div className={styles.statValue}>{stats?.total ?? 0}</div>
        </div>
        <div className={clsx(styles.statCard, styles.statCardPurple)}>
          <div className={styles.statLabel}>Avec commentaire</div>
          <div className={styles.statValue}>{stats?.withComment ?? 0}</div>
        </div>
        <div className={clsx(styles.statCard, styles.statCardOrange)}>
          <div className={styles.statLabel}>Snoozés (en cours)</div>
          <div className={styles.statValue}>{stats?.snoozed ?? 0}</div>
        </div>
      </div>

      {stats && stats.total > 0 && (
        <div className="fr-mb-3w">
          <h2 className="fr-h6 fr-mb-1w">Répartition des notes</h2>
          <div className="fr-flex fr-flex-gap-2v">
            {stats.distribution.map(({ rating: r, count: c }) => {
              const pct = stats.total > 0 ? Math.round((c / stats.total) * 100) : 0
              return (
                <div key={r} className={clsx(styles.statCard, styles.statCardBlue)} style={{ flex: 1 }}>
                  <div className={styles.statLabel}>
                    {r} étoile{sPluriel(r)}
                  </div>
                  <div className={styles.statValue}>{c}</div>
                  <div className="fr-text--xs fr-text-mention--grey">{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w fr-align-items-end">
        <div className="fr-col-md-3">
          <Input
            label="Du"
            nativeInputProps={{
              type: 'date',
              value: from,
              onChange: (e) => setQueryStates({ from: e.target.value, page: 1 }),
            }}
          />
        </div>
        <div className="fr-col-md-3">
          <Input
            label="Au"
            nativeInputProps={{
              type: 'date',
              value: to,
              onChange: (e) => setQueryStates({ to: e.target.value, page: 1 }),
            }}
          />
        </div>
        <div className="fr-col-md-3">
          <Select
            label="Note"
            nativeSelectProps={{
              value: rating,
              onChange: (e) => setQueryStates({ rating: e.target.value, page: 1 }),
            }}
            options={ratingOptions}
          />
        </div>
      </div>

      <AdminDataTable
        columns={columns}
        data={data?.items ?? []}
        pageCount={data?.pageCount ?? 0}
        page={page}
        onPageChange={(p) => setQueryStates({ page: p })}
        isLoading={isLoading}
      />
    </>
  )
}
