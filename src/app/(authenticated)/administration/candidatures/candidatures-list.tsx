'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useMemo } from 'react'
import { useDebounce } from 'use-debounce'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { EOwnerContactMode, OWNER_CONTACT_MODE_LABELS } from '~/enums/owner-contact-mode'
import { useTRPC } from '~/server/trpc/client'
import { getDateFrom } from '~/utils/date-helpers'
import { sPluriel } from '~/utils/sPluriel'
import styles from '../administration.module.css'
import statStyles from '../statistiques/statistiques.module.css'

const PRESETS = ['7', '15', '30', '90'] as const

type CandidatureRow = {
  id: number
  name: string
  slug: string
  city: string
  ownerId: number | null
  ownerName: string
  contactMode: EOwnerContactMode | null
  contactCount: number
  dossierFacileCount: number
  scholarshipHolderCount: number
  activeCount: number
  total: number
  canAccessOwnerSpace: boolean
}

const columns: ColumnDef<CandidatureRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Résidence',
    enableSorting: true,
    cell: ({ row }) => (
      <div>
        <span className="fr-text--bold">{row.original.name}</span>
        <div className="fr-text--xs fr-text-mention--grey">{row.original.city}</div>
      </div>
    ),
  },
  {
    accessorKey: 'ownerName',
    header: 'Gestionnaire',
    enableSorting: true,
    cell: ({ row }) => (
      <div>
        {row.original.ownerName}
        {row.original.contactMode && (
          <div className="fr-text--xs fr-text-mention--grey">{OWNER_CONTACT_MODE_LABELS[row.original.contactMode]}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'total',
    header: 'Candidatures',
    enableSorting: true,
    cell: ({ row }) => (
      <div>
        <span className="fr-text--bold">{row.original.total}</span>
        <div className="fr-text--xs fr-text-mention--grey">
          {row.original.contactCount} coordonnées · {row.original.dossierFacileCount} DossierFacile
        </div>
        <div className="fr-text--xs fr-text-mention--grey">
          {row.original.scholarshipHolderCount} boursier{sPluriel(row.original.scholarshipHolderCount)}
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'activeCount',
    header: 'Encore visibles',
    enableSorting: true,
    cell: ({ row }) =>
      row.original.activeCount > 0 ? (
        <Badge severity="success" noIcon as="span">
          {row.original.activeCount}
        </Badge>
      ) : (
        <Badge noIcon as="span">
          0
        </Badge>
      ),
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) =>
      // Un admin n'accède à l'espace d'un gestionnaire que s'il y est rattaché : sans le lien, la
      // redirection retomberait sur un autre bailleur sans rien dire.
      row.original.canAccessOwnerSpace ? (
        <Button
          priority="tertiary no outline"
          size="small"
          iconId="fr-icon-arrow-right-line"
          iconPosition="right"
          linkProps={{ href: `/bailleur/contacts/${row.original.slug}?ownerId=${row.original.ownerId}` }}
        >
          Espace gestionnaire
        </Button>
      ) : (
        <span className="fr-text--xs fr-text-mention--grey" title="Liez-vous à ce gestionnaire depuis le tableau de bord">
          Non rattaché
        </span>
      ),
  },
]

export function AdminCandidaturesList() {
  const trpc = useTRPC()
  const [{ search, page, preset, from, to }, setQueryStates] = useQueryStates({
    search: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    preset: parseAsStringLiteral(PRESETS).withDefault('30'),
    from: parseAsString.withDefault(''),
    to: parseAsString.withDefault(''),
  })
  const [debouncedSearch] = useDebounce(search, 300)

  const period = useMemo(() => {
    if (from && to) return { from, to }
    return { from: getDateFrom(Number(preset)), to: getDateFrom(0) }
  }, [preset, from, to])
  const isPeriodValid = period.from <= period.to

  const { data: overview, isLoading: isOverviewLoading } = useQuery({
    ...trpc.admin.candidatures.overview.queryOptions(period),
    enabled: isPeriodValid,
  })
  const { data, isLoading } = useQuery({
    ...trpc.admin.candidatures.list.queryOptions({
      ...period,
      page,
      search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
    }),
    enabled: isPeriodValid,
  })

  const scholarshipHolders = overview?.scholarship.yes ?? 0
  const scholarshipShare = overview?.total ? Math.round((scholarshipHolders / overview.total) * 100) : 0
  const exportHref = `/api/admin/candidatures/export?${new URLSearchParams(period).toString()}`

  const statCards = [
    {
      label: `Candidature${sPluriel(overview?.total ?? 0)} sur la période`,
      value: overview?.total ?? 0,
      icon: 'fr-icon-file-text-line',
      colorClass: styles.statCardBlue,
    },
    {
      label: `Encore visible${sPluriel(overview?.active ?? 0)} (${overview?.retentionDays ?? 30} j)`,
      value: overview?.active ?? 0,
      icon: 'fr-icon-eye-line',
      colorClass: styles.statCardGreen,
    },
    {
      label: `À traiter par les gestionnaires`,
      value: overview?.toProcess ?? 0,
      icon: 'fr-icon-time-line',
      colorClass: styles.statCardOrange,
    },
    {
      label: `Boursiers (${scholarshipHolders} · ${overview?.scholarship.missing ?? 0} non renseigné${sPluriel(overview?.scholarship.missing ?? 0)})`,
      value: `${scholarshipShare} %`,
      icon: 'fr-icon-user-star-line',
      colorClass: styles.statCardRed,
    },
    {
      label: `Résidence${sPluriel(overview?.residences ?? 0)} concernée${sPluriel(overview?.residences ?? 0)}`,
      value: overview?.residences ?? 0,
      icon: 'fr-icon-home-4-line',
      colorClass: styles.statCardPurple,
    },
  ]

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-file-text-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Candidatures</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">
          Candidatures reçues par résidence, tous canaux confondus. Passé {overview?.retentionDays ?? 30} jours, une candidature n&apos;est
          plus visible du gestionnaire mais reste comptée ici. Le statut boursier vient de la candidature, ou à défaut du profil actuel de
          l&apos;étudiant connecté.
        </p>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className={clsx(statStyles.dateRangeBar, 'fr-p-2w')}>
          <div className={statStyles.dateRangePresets}>
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={preset === p && !from}
                className={preset === p && !from ? statStyles.dateRangePresetActive : statStyles.dateRangePreset}
                onClick={() => setQueryStates({ preset: p, from: '', to: '', page: 1 })}
              >
                {p} jours
              </button>
            ))}
          </div>
          <div className={statStyles.dateInputs}>
            <input
              type="date"
              aria-label="Date de début"
              className={statStyles.dateInput}
              value={period.from}
              max={period.to}
              onChange={(e) => e.target.value && setQueryStates({ from: e.target.value, to: period.to, page: 1 })}
            />
            <span className="fr-text--sm fr-mb-0" aria-hidden="true">
              —
            </span>
            <input
              type="date"
              aria-label="Date de fin"
              className={statStyles.dateInput}
              value={period.to}
              min={period.from}
              onChange={(e) => e.target.value && setQueryStates({ from: period.from, to: e.target.value, page: 1 })}
            />
            <Button iconId="fr-icon-download-line" priority="secondary" size="small" linkProps={{ href: exportHref }}>
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      <div className={clsx(styles.statsGrid, styles.statsGrid5, 'fr-mb-3w')}>
        {statCards.map((card) => (
          <div key={card.label} className={clsx(styles.statCard, card.colorClass)}>
            <div className={styles.statLabel}>{card.label}</div>
            <div className={clsx(styles.statValue, 'fr-mt-1v')}>{isOverviewLoading ? '-' : card.value}</div>
            <span className={clsx(card.icon, styles.statIcon)} aria-hidden="true" />
          </div>
        ))}
      </div>

      <div className="fr-grid-row fr-grid-row--gutters fr-mb-2w fr-align-items-end">
        <div className="fr-col-md-5">
          <Input
            label="Rechercher"
            nativeInputProps={{
              placeholder: 'Résidence, ville, gestionnaire...',
              value: search,
              onChange: (e) => setQueryStates({ search: e.target.value, page: 1 }),
            }}
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
