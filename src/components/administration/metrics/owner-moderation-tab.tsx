'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import type { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { useAdminModeration } from '~/hooks/use-admin-metrics'
import type { TOwnerModerationRow } from '~/server/admin-metrics/moderation'
import { SEGMENT_LABELS, type TOwnerSegment } from '~/server/admin-metrics/segment'
import styles from '../../../app/(authenticated)/administration/administration.module.css'
import { MonthFilter, useMonth } from './month-filter'

const SEGMENTS = Object.keys(SEGMENT_LABELS) as TOwnerSegment[]

const SEGMENT_SEVERITY = {
  bon_eleve: 'success',
  irregulier: 'warning',
  mauvais_eleve: 'error',
  non_concerne: 'info',
} as const satisfies Record<TOwnerSegment, 'success' | 'warning' | 'error' | 'info'>

const SEGMENT_CARD = {
  bon_eleve: styles.statCardGreen,
  irregulier: styles.statCardOrange,
  mauvais_eleve: styles.statCardRed,
  non_concerne: styles.statCardBlue,
} as const satisfies Record<TOwnerSegment, string>

const formatPercent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)} %`)

const ratio = (part: number, total: number) => (total === 0 ? null : part / total)

const formatDelay = (hours: number | null) => {
  if (hours === null) return '—'
  return hours < 48 ? `${Math.round(hours)} h` : `${Math.round(hours / 24)} j`
}

const columns: ColumnDef<TOwnerModerationRow, unknown>[] = [
  { accessorKey: 'ownerName', header: 'Gestionnaire', size: 220 },
  {
    accessorKey: 'segment',
    header: 'Segment',
    cell: ({ row }) => (
      <Badge small noIcon severity={SEGMENT_SEVERITY[row.original.segment]}>
        {SEGMENT_LABELS[row.original.segment]}
      </Badge>
    ),
    size: 140,
  },
  { accessorKey: 'recus', header: 'Contacts reçus', size: 100 },
  { accessorKey: 'aTraiter', header: 'À traiter', size: 90 },
  { accessorKey: 'traites', header: 'Traités', size: 90 },
  {
    id: 'delaiMoyenHeures',
    accessorFn: (row) => row.delaiMoyenHeures,
    header: 'Délai moyen de première réponse',
    cell: ({ row }) => formatDelay(row.original.delaiMoyenHeures),
    size: 140,
  },
  {
    id: 'partJamaisTraites',
    accessorFn: (row) => ratio(row.jamaisTraites, row.recus),
    header: 'Jamais traités',
    cell: ({ row }) => formatPercent(ratio(row.original.jamaisTraites, row.original.recus)),
    size: 110,
  },
  {
    id: 'partContactes',
    accessorFn: (row) => ratio(row.contactes, row.recus),
    header: 'Contactés',
    cell: ({ row }) => formatPercent(ratio(row.original.contactes, row.original.recus)),
    size: 100,
  },
  {
    id: 'partBoursiers',
    accessorFn: (row) => ratio(row.recusBoursiers, row.recus),
    header: 'Boursiers',
    cell: ({ row }) => formatPercent(ratio(row.original.recusBoursiers, row.original.recus)),
    size: 100,
  },
  { accessorKey: 'alertes', header: 'Alertes', size: 80 },
  { accessorKey: 'suspensions', header: 'Suspensions', size: 100 },
]

export const OwnerModerationTab = () => {
  const [month, setMonth] = useMonth()
  const { data, isLoading, isError } = useAdminModeration(month)
  const rows = data ?? []

  return (
    <>
      <p className="fr-text--sm fr-text-mention--grey">
        Bon élève : aucune alerte d&apos;inactivité dans le mois. Irrégulier : au moins une alerte, sans suspension. Mauvais élève :
        suspension automatique, ou contacts à traiter sans aucun traité. Non concerné : aucun contact à traiter.
      </p>

      <MonthFilter month={month} onChange={setMonth} />

      <div className={clsx(styles.statsGrid, 'fr-my-3w')}>
        {SEGMENTS.map((segment) => (
          <div key={segment} className={clsx(styles.statCard, SEGMENT_CARD[segment])}>
            <div className={styles.statLabel}>{SEGMENT_LABELS[segment]}</div>
            <div className={clsx(styles.statValue, 'fr-mt-1v')}>
              {isLoading ? '-' : rows.filter((row) => row.segment === segment).length}
            </div>
          </div>
        ))}
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Modération des contacts ({rows.length})</span>
          <Button
            size="small"
            priority="secondary"
            iconId="fr-icon-download-line"
            linkProps={{ href: `/api/admin/metriques/export?item=moderation&month=${month}`, download: true }}
          >
            Exporter en CSV
          </Button>
        </div>
        <div className="fr-px-2w">
          <AdminDataTable columns={columns} data={rows} pageCount={1} page={1} isLoading={isLoading} isError={isError} hidePagination />
        </div>
      </div>
    </>
  )
}
