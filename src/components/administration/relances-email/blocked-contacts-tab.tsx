'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Badge from '@codegouvfr/react-dsfr/Badge'
import Select from '@codegouvfr/react-dsfr/SelectNext'
import { type ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import Link from 'next/link'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { Pagination } from '~/components/ui/pagination'
import { useAdminBlockedContacts } from '~/hooks/use-admin-reminders'
import type { TBlockedReason } from '~/server/services/brevo-reminders'
import styles from '../../../app/(authenticated)/administration/administration.module.css'
import { BLOCKED_REASON_CODES, BLOCKED_REASON_LABELS, formatDateTime } from './labels'

type BlockedContactsData = NonNullable<ReturnType<typeof useAdminBlockedContacts>['data']>
type BlockedContactRow = BlockedContactsData['rows'][number]

const REASON_OPTIONS = [
  { label: 'Tous les motifs', value: '' },
  ...BLOCKED_REASON_CODES.map((code) => ({ label: BLOCKED_REASON_LABELS[code], value: code })),
]

const columns: ColumnDef<BlockedContactRow, unknown>[] = [
  {
    accessorKey: 'userName',
    header: 'Gestionnaire',
    cell: ({ row }) => <span className="fr-text--sm fr-text--bold">{row.original.userName ?? '—'}</span>,
  },
  {
    accessorKey: 'ownerName',
    header: 'Bailleur',
    cell: ({ row }) =>
      row.original.ownerName && row.original.ownerId ? (
        <Link href={`/administration/bailleurs/${row.original.ownerId}`} className="fr-link fr-text--sm">
          {row.original.ownerName}
        </Link>
      ) : (
        <span className="fr-text--sm fr-text-mention--grey">—</span>
      ),
  },
  {
    accessorKey: 'email',
    header: 'Adresse',
    cell: ({ row }) => <span className="fr-text--sm">{row.original.email}</span>,
  },
  {
    accessorKey: 'blockedAt',
    header: 'Date du blocage',
    cell: ({ row }) => <span className="fr-text--sm">{formatDateTime(row.original.blockedAt)}</span>,
  },
  {
    accessorKey: 'reason',
    header: 'Motif',
    cell: ({ row }) => <span className="fr-text--sm">{row.original.reason ? BLOCKED_REASON_LABELS[row.original.reason] : '—'}</span>,
  },
  {
    id: 'consequence',
    header: 'Conséquence',
    cell: () => (
      <Badge as="span" noIcon small severity="error">
        Ne peut plus se connecter
      </Badge>
    ),
  },
]

type BlockedContactsTabProps = {
  from: string
  to: string
  page: number
  reason: TBlockedReason | null
  onReasonChange: (reason: TBlockedReason | null) => void
  onPageChange: (page: number) => void
}

export const BlockedContactsTab = ({ from, to, page, reason, onReasonChange, onPageChange }: BlockedContactsTabProps) => {
  const { data, isLoading, isError, error } = useAdminBlockedContacts({ from, to, page, reason: reason ?? undefined })

  const summary = data?.summary
  const value = (count: number | undefined) => (isLoading || count === undefined ? '-' : count)

  return (
    <>
      <div className={clsx(styles.statsGrid, 'fr-mb-2w')}>
        <div className={clsx(styles.statCard, styles.statCardRed)}>
          <div className={styles.statLabel}>Bloquées sur la période</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{value(summary?.blockedInPeriod)}</div>
          <span className={clsx('fr-icon-lock-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardOrange)}>
          <div className={styles.statLabel}>dont désabonnements</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{value(summary?.unsubscribedInPeriod)}</div>
          <span className={clsx('fr-icon-mail-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardBlue)}>
          <div className={styles.statLabel}>Total actuel</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{value(summary?.totalBlocked)}</div>
          <span className={clsx('fr-icon-user-line', styles.statIcon)} aria-hidden="true" />
        </div>
      </div>
      <p className="fr-text--sm fr-text-mention--grey fr-mb-3w">
        Brevo retire une adresse de cette liste dès qu&apos;elle est débloquée : les périodes passées ne comptent que les adresses encore
        bloquées aujourd&apos;hui.
      </p>

      <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w fr-align-items-end">
        <div className="fr-col-12 fr-col-md-4">
          <Select
            label="Motif"
            nativeSelectProps={{
              value: reason ?? '',
              onChange: (e) => onReasonChange(e.target.value ? (e.target.value as TBlockedReason) : null),
            }}
            options={REASON_OPTIONS}
          />
        </div>
      </div>

      {isError && <Alert severity="error" title="Erreur de chargement" description={error.message} className="fr-mb-3w" />}

      <AdminDataTable
        columns={columns}
        data={data?.rows ?? []}
        pageCount={data?.pageCount ?? 0}
        page={page}
        onPageChange={onPageChange}
        isLoading={isLoading}
        isError={isError}
        hidePagination
      />

      {(data?.pageCount ?? 0) > 1 && (
        <Pagination
          className="fr-flex fr-justify-content-center fr-mt-3w"
          count={data!.pageCount}
          defaultPage={page}
          getPageLinkProps={(target) => ({
            href: '#',
            onClick: (e) => {
              e.preventDefault()
              onPageChange(target)
            },
          })}
        />
      )}
    </>
  )
}
