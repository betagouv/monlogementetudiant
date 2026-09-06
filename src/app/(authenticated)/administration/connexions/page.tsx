'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Badge from '@codegouvfr/react-dsfr/Badge'
import Tag from '@codegouvfr/react-dsfr/Tag'
import { type ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useMemo } from 'react'
import { useDebounce } from 'use-debounce'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { Pagination } from '~/components/ui/pagination'
import {
  ELoginOutcome,
  FAILED_LOGIN_OUTCOMES,
  isFailedLoginOutcome,
  LOGIN_OUTCOME_LABELS,
  LOGIN_OUTCOMES,
} from '~/enums/login-attempt-status'
import { useAdminConnections, useAdminStrandedAccounts } from '~/hooks/use-admin-connections'
import { getDateFrom } from '~/utils/date-helpers'
import styles from '../administration.module.css'
import statStyles from '../statistiques/statistiques.module.css'

const PRESETS = ['7', '15', '30', '90'] as const
type Preset = (typeof PRESETS)[number]

const OUTCOME_SEVERITY: Record<ELoginOutcome, 'success' | 'warning' | 'error' | 'info' | undefined> = {
  [ELoginOutcome.COMPLETED]: 'success',
  [ELoginOutcome.PENDING]: 'info',
  [ELoginOutcome.NEVER_CLICKED]: 'warning',
  [ELoginOutcome.EXPIRED]: 'warning',
  [ELoginOutcome.INVALID]: 'error',
}

type ConnectionRow = {
  id: number
  createdAt: Date | string
  email: string | null
  role: string | null
  accountName: string | null
  ownerId: number | null
  ownerName: string | null
  outcome: ELoginOutcome
  verifiedAt: Date | string | null
  verifiedUserAgent: string | null
  delaySeconds: number | null
}

type StrandedAccount = {
  email: string | null
  accountName: string | null
  ownerId: number | null
  ownerName: string | null
  attempts: number
  completed: number
  lastAttemptAt: Date | string
}

const formatDateTime = (value: Date | string) =>
  new Date(value).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Délai d'ouverture du lien, en unités lisibles : c'est le signal qui explique un « ouvert trop tard ». */
const formatDelay = (seconds: number | null) => {
  if (seconds === null) return '—'
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} j`
}

const columns: ColumnDef<ConnectionRow, unknown>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Lien envoyé le',
    enableSorting: true,
    cell: ({ row }) => <span className="fr-text--sm">{formatDateTime(row.original.createdAt)}</span>,
  },
  {
    accessorKey: 'accountName',
    header: 'Compte',
    enableSorting: true,
    cell: ({ row }) => (
      <div>
        <div className="fr-text--sm fr-text--bold">{row.original.accountName ?? row.original.email ?? 'Compte inconnu'}</div>
        {row.original.accountName && row.original.email && (
          <div className="fr-text--xs fr-text-mention--grey">{row.original.email}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'ownerName',
    header: 'Gestionnaire',
    enableSorting: true,
    cell: ({ row }) =>
      row.original.ownerName && row.original.ownerId ? (
        <Link href={`/administration/bailleurs/${row.original.ownerId}`} className="fr-link fr-text--sm">
          {row.original.ownerName}
        </Link>
      ) : (
        <span className="fr-text--sm fr-text-mention--grey">{row.original.role === 'admin' ? 'Administration' : '—'}</span>
      ),
  },
  {
    accessorKey: 'outcome',
    header: 'Issue',
    enableSorting: true,
    cell: ({ row }) => (
      <Badge as="span" noIcon small severity={OUTCOME_SEVERITY[row.original.outcome]}>
        {LOGIN_OUTCOME_LABELS[row.original.outcome]}
      </Badge>
    ),
  },
  {
    accessorKey: 'delaySeconds',
    header: 'Ouvert après',
    enableSorting: true,
    cell: ({ row }) => <span className="fr-text--sm">{formatDelay(row.original.delaySeconds)}</span>,
  },
]

export default function ConnexionsPage() {
  const [qs, setQs] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    search: parseAsString.withDefault(''),
    preset: parseAsStringLiteral(PRESETS).withDefault('30'),
    from: parseAsString.withDefault(''),
    to: parseAsString.withDefault(''),
    outcome: parseAsStringLiteral(LOGIN_OUTCOMES),
  })
  const [debouncedSearch] = useDebounce(qs.search, 300)

  const range = useMemo(() => {
    if (qs.from && qs.to) return { from: qs.from, to: qs.to }
    return { from: getDateFrom(Number(qs.preset)), to: getDateFrom(0) }
  }, [qs.preset, qs.from, qs.to])

  const filters = {
    search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
    from: range.from,
    to: range.to,
  }

  const { data, isLoading, isError, error } = useAdminConnections({
    ...filters,
    page: qs.page,
    outcome: qs.outcome ?? undefined,
  })
  const { data: stranded } = useAdminStrandedAccounts(filters)

  const counts = data?.outcomeCounts
  const totalSent = counts ? LOGIN_OUTCOMES.reduce((sum, outcome) => sum + counts[outcome], 0) : 0
  const failedCount = counts ? FAILED_LOGIN_OUTCOMES.reduce((sum, outcome) => sum + counts[outcome], 0) : 0
  const completedCount = counts?.[ELoginOutcome.COMPLETED] ?? 0
  // Les liens encore valides ne sont ni un succès ni un échec : les inclure ferait baisser le taux
  // à chaque envoi récent, pour une raison qui n'a rien à voir avec un problème de connexion.
  const settledCount = totalSent - (counts?.[ELoginOutcome.PENDING] ?? 0)
  const completionRate = settledCount > 0 ? Math.round((completedCount / settledCount) * 100) : null

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-lock-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Connexions</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">
          Suivi des connexions des gestionnaires, qui se font par lien envoyé par e-mail (valable 10 minutes)
        </p>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className="fr-p-2w">
          <div className={statStyles.dateRangeBar}>
            <input
              type="text"
              placeholder="Gestionnaire, nom ou e-mail..."
              value={qs.search}
              onChange={(e) => setQs({ search: e.target.value, page: 1 })}
              className={statStyles.dateInput}
              style={{ width: '260px' }}
              aria-label="Rechercher par gestionnaire, nom de compte ou e-mail"
            />
            <div className={statStyles.dateRangePresets}>
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={qs.preset === preset && !qs.from ? statStyles.dateRangePresetActive : statStyles.dateRangePreset}
                  onClick={() => setQs({ preset, from: '', to: '', page: 1 })}
                >
                  {preset} jours
                </button>
              ))}
            </div>
            <div className={statStyles.dateInputs}>
              <input
                type="date"
                className={statStyles.dateInput}
                value={qs.from || range.from}
                onChange={(e) => setQs({ from: e.target.value, to: qs.to || range.to, page: 1 })}
                aria-label="Date de début"
              />
              <span className="fr-text--sm fr-mb-0">—</span>
              <input
                type="date"
                className={statStyles.dateInput}
                value={qs.to || range.to}
                onChange={(e) => setQs({ from: qs.from || range.from, to: e.target.value, page: 1 })}
                aria-label="Date de fin"
              />
            </div>
          </div>
        </div>
      </div>

      {failedCount > 0 && (
        <Alert
          severity="warning"
          className="fr-mb-3w"
          title={`${failedCount} connexion${failedCount > 1 ? 's' : ''} non aboutie${failedCount > 1 ? 's' : ''} sur la période`}
          description={
            <>
              {FAILED_LOGIN_OUTCOMES.filter((outcome) => (counts?.[outcome] ?? 0) > 0)
                .map((outcome) => `${counts?.[outcome]} ${LOGIN_OUTCOME_LABELS[outcome].toLowerCase()}`)
                .join(' · ')}
              {stranded && stranded.length > 0 && (
                <>
                  {' — '}
                  {stranded.length} compte{stranded.length > 1 ? 's' : ''} n&apos;{stranded.length > 1 ? 'ont' : 'a'} jamais réussi à
                  se connecter sur la période.
                </>
              )}
            </>
          }
        />
      )}

      <div className={clsx(styles.statsGrid, 'fr-mb-3w')}>
        <div className={clsx(styles.statCard, styles.statCardBlue)}>
          <div className={styles.statLabel}>Liens envoyés</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{isLoading ? '-' : totalSent}</div>
          <span className={clsx('fr-icon-mail-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardGreen)}>
          <div className={styles.statLabel}>Connexions abouties</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{isLoading ? '-' : completedCount}</div>
          <span className={clsx('fr-icon-check-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardOrange)}>
          <div className={styles.statLabel}>Taux d&apos;aboutissement</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{completionRate === null ? '—' : `${completionRate} %`}</div>
          <span className={clsx('fr-icon-percent-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardRed)}>
          <div className={styles.statLabel}>Non abouties</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{isLoading ? '-' : failedCount}</div>
          <span className={clsx('fr-icon-warning-line', styles.statIcon)} aria-hidden="true" />
        </div>
      </div>

      <div className="fr-flex fr-align-items-center fr-flex-gap-2v fr-mb-3w fr-flex-wrap">
        <span className="fr-text--sm fr-text--bold fr-mb-0">Issue :</span>
        <Tag as="button" small pressed={!qs.outcome} onClick={() => setQs({ outcome: null, page: 1 })}>
          Toutes
        </Tag>
        {LOGIN_OUTCOMES.map((outcome) => (
          <Tag
            key={outcome}
            as="button"
            small
            pressed={qs.outcome === outcome}
            onClick={() => setQs({ outcome: qs.outcome === outcome ? null : outcome, page: 1 })}
          >
            {LOGIN_OUTCOME_LABELS[outcome]}
            {counts ? ` (${counts[outcome]})` : ''}
          </Tag>
        ))}
      </div>

      {isError && (
        <Alert
          severity="error"
          title="Erreur de chargement"
          description={error?.message ?? 'Impossible de charger les connexions.'}
          className="fr-mb-3w"
        />
      )}

      <AdminDataTable
        columns={columns}
        data={(data?.items ?? []) as ConnectionRow[]}
        pageCount={data?.pageCount ?? 0}
        page={qs.page}
        onPageChange={(page) => setQs({ page })}
        isLoading={isLoading}
        isError={isError}
        hidePagination
      />

      {(data?.pageCount ?? 0) > 1 && (
        <Pagination
          className="fr-flex fr-justify-content-center fr-mt-3w"
          count={data!.pageCount}
          defaultPage={qs.page}
          getPageLinkProps={(page) => ({
            href: '#',
            onClick: (e) => {
              e.preventDefault()
              setQs({ page })
            },
          })}
        />
      )}

      {stranded && stranded.length > 0 && (
        <div className={clsx(styles.card, 'fr-mt-3w')}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Comptes restés à la porte ({stranded.length})</span>
          </div>
          <div className={clsx('fr-table', styles.tableWrapper)}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Compte</th>
                  <th scope="col">Gestionnaire</th>
                  <th scope="col">Liens demandés</th>
                  <th scope="col">Dernière tentative</th>
                </tr>
              </thead>
              <tbody>
                {stranded.map((account: StrandedAccount) => (
                  <tr key={`${account.email ?? 'inconnu'}-${account.ownerId ?? 0}`}>
                    <td>
                      <div className="fr-text--sm fr-text--bold">{account.accountName ?? account.email ?? 'Compte inconnu'}</div>
                      {account.accountName && account.email && (
                        <div className="fr-text--xs fr-text-mention--grey">{account.email}</div>
                      )}
                    </td>
                    <td className="fr-text--sm">
                      {account.ownerName && account.ownerId ? (
                        <Link href={`/administration/bailleurs/${account.ownerId}`} className="fr-link fr-text--sm">
                          {account.ownerName}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="fr-text--sm">{account.attempts}</td>
                    <td className="fr-text--sm">{formatDateTime(account.lastAttemptAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
