'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Badge from '@codegouvfr/react-dsfr/Badge'
import Select from '@codegouvfr/react-dsfr/SelectNext'
import { type ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import Link from 'next/link'
import { AdminClientPagination } from '~/components/administration/admin-client-pagination'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { EReminderType, REMINDER_TYPE_LABELS } from '~/enums/reminder-email'
import { useAdminReminderEmails } from '~/hooks/use-admin-reminders'
import type { TBrevoEmailStatus } from '~/server/services/brevo-reminders'
import { formatDateTime, formatDelay } from '~/utils/format-admin'
import styles from '../../../app/(authenticated)/administration/administration.module.css'
import { EFFICACY_LABELS, EMAIL_STATUS_LABELS } from './labels'

type SentEmailsData = NonNullable<ReturnType<typeof useAdminReminderEmails>['data']>
type SentEmailRow = SentEmailsData['rows'][number]

const STATUS_SEVERITY: Record<TBrevoEmailStatus, 'success' | 'error' | 'info'> = {
  sent: 'info',
  deferred: 'info',
  delivered: 'success',
  opened: 'success',
  clicked: 'success',
  bounced: 'error',
  blocked: 'error',
  error: 'error',
}

const TYPE_OPTIONS = [
  { label: 'Toutes les relances', value: '' },
  ...Object.values(EReminderType).map((type) => ({ label: REMINDER_TYPE_LABELS[type], value: type })),
]

const columns: ColumnDef<SentEmailRow, unknown>[] = [
  {
    accessorKey: 'sentAt',
    header: "Date d'envoi",
    cell: ({ row }) => <span className="fr-text--sm">{formatDateTime(row.original.sentAt)}</span>,
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => <span className="fr-text--sm">{REMINDER_TYPE_LABELS[row.original.type]}</span>,
  },
  {
    id: 'recipient',
    header: 'Destinataire',
    cell: ({ row }) => (
      <div>
        <div className="fr-text--sm fr-text--bold">{row.original.userName ?? row.original.email}</div>
        <div className="fr-text--xs fr-text-mention--grey fr-mb-0">
          {row.original.userName ? row.original.email : 'Aucun compte associé'}
        </div>
        {row.original.ownerName && row.original.ownerId && (
          <Link href={`/administration/bailleurs/${row.original.ownerId}`} className="fr-link fr-text--xs">
            {row.original.ownerName}
          </Link>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Statut',
    cell: ({ row }) => (
      <Badge as="span" noIcon small severity={STATUS_SEVERITY[row.original.status]}>
        {EMAIL_STATUS_LABELS[row.original.status]}
      </Badge>
    ),
  },
  {
    accessorKey: 'residencesCount',
    header: 'Résidences citées',
    cell: ({ row }) => <span className="fr-text--sm">{row.original.residencesCount ?? '—'}</span>,
  },
  {
    accessorKey: 'efficacy',
    header: 'Efficacité',
    cell: ({ row }) => <span className="fr-text--sm">{EFFICACY_LABELS[row.original.efficacy]}</span>,
  },
  {
    accessorKey: 'reactionMs',
    header: 'Délai',
    cell: ({ row }) => (
      <span className="fr-text--sm">
        {formatDelay(row.original.reactionMs === null ? null : Math.round(row.original.reactionMs / 1000))}
      </span>
    ),
  },
]

type SentEmailsTabProps = {
  from: string
  to: string
  page: number
  type: EReminderType | null
  search: string
  onTypeChange: (type: EReminderType | null) => void
  onPageChange: (page: number) => void
}

export const SentEmailsTab = ({ from, to, page, type, search, onTypeChange, onPageChange }: SentEmailsTabProps) => {
  const { data, isLoading, isError, error } = useAdminReminderEmails({
    from,
    to,
    page,
    type: type ?? undefined,
    search: search.length >= 2 ? search : undefined,
  })

  const summary = data?.summary
  const settled = summary ? summary.effective + summary.failed : 0
  const efficacyRate = summary && settled > 0 ? Math.round((summary.effective / settled) * 100) : null
  const value = (count: number | undefined) => (isLoading || count === undefined ? '-' : count)

  return (
    <>
      <div className={clsx(styles.statsGrid, 'fr-mb-2w')}>
        <div className={clsx(styles.statCard, styles.statCardBlue)}>
          <div className={styles.statLabel}>Envoyés</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{value(summary?.sent)}</div>
          <span className={clsx('fr-icon-mail-send-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardBlue)}>
          <div className={styles.statLabel}>Délivrés</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{value(summary?.delivered)}</div>
          <span className={clsx('fr-icon-mail-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardBlue)}>
          <div className={styles.statLabel}>Ouverts</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{value(summary?.opened)}</div>
          <span className={clsx('fr-icon-eye-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardGreen)}>
          <div className={styles.statLabel}>Efficaces</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{value(summary?.effective)}</div>
          <span className={clsx('fr-icon-check-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardRed)}>
          <div className={styles.statLabel}>En échec</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{value(summary?.failed)}</div>
          <span className={clsx('fr-icon-warning-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardOrange)}>
          <div className={styles.statLabel}>En cours</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{value(summary?.pending)}</div>
          <span className={clsx('fr-icon-time-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardGreen)}>
          <div className={styles.statLabel}>Taux d&apos;efficacité</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{efficacyRate === null ? '—' : `${efficacyRate} %`}</div>
          <span className={clsx('fr-icon-percent-line', styles.statIcon)} aria-hidden="true" />
        </div>
      </div>
      <p className="fr-text--sm fr-text-mention--grey fr-mb-3w">
        L&apos;efficacité n&apos;est mesurée que pour les relances envoyées depuis la mise en ligne de cet écran.
      </p>

      <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w fr-align-items-end">
        <div className="fr-col-12 fr-col-md-4">
          <Select
            label="Type de relance"
            nativeSelectProps={{
              value: type ?? '',
              onChange: (e) => onTypeChange(e.target.value ? (e.target.value as EReminderType) : null),
            }}
            options={TYPE_OPTIONS}
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

      <AdminClientPagination count={data?.pageCount ?? 0} page={page} onPageChange={onPageChange} />
    </>
  )
}
