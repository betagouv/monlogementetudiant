'use client'

import { type ColumnDef } from '@tanstack/react-table'
import clsx from 'clsx'
import Image from 'next/image'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ActivityItem } from '~/components/administration/activity-item'
import { AdminDataTable } from '~/components/administration/admin-data-table'
import { useOwnerUsage, useOwnerUsageDetail } from '~/hooks/use-owner-usage'
import { getAvatarColor, getInitials } from '~/utils/avatar'
import { formatChartDate, getDateFrom } from '~/utils/date-helpers'
import { getFaviconUrl } from '~/utils/get-favicon-url'
import styles from '../administration.module.css'
import statStyles from '../statistiques/statistiques.module.css'
import pageStyles from './gestionnaires-stats.module.css'

const PRESETS = ['7', '30', '90'] as const
type Preset = (typeof PRESETS)[number]

type OwnerRow = {
  id: number
  name: string
  slug: string
  url: string | null
  imageBase64: string | null
  nbLogins: number
  lastLogin: string | null
  nbActions: number
  nbCreated: number
  nbUpdated: number
  nbAvailabilityUpdated: number
  nbAccommodations: number
  nbDepublished: number
}

function OwnerAvatarCell({ owner }: { owner: OwnerRow }) {
  const faviconUrl = owner.url ? getFaviconUrl(owner.url) : null
  return (
    <div className={pageStyles.ownerCell}>
      {owner.imageBase64 ? (
        <Image src={owner.imageBase64} alt={owner.name} width={32} height={32} className={pageStyles.ownerAvatar} unoptimized />
      ) : faviconUrl ? (
        <Image src={faviconUrl} alt={owner.name} width={32} height={32} className={pageStyles.ownerAvatar} unoptimized />
      ) : (
        <div className={pageStyles.ownerAvatar} style={{ background: getAvatarColor(owner.name) }}>
          {getInitials(owner.name)}
        </div>
      )}
      <span className="fr-text--bold">{owner.name}</span>
    </div>
  )
}

const ownerColumns: ColumnDef<OwnerRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Gestionnaire',
    cell: ({ row }) => <OwnerAvatarCell owner={row.original} />,
    size: 250,
  },
  { accessorKey: 'nbLogins', header: 'Connexions', size: 100 },
  {
    accessorKey: 'lastLogin',
    header: 'Dernière connexion',
    cell: ({ getValue }) => {
      const v = getValue() as string | null
      return v ? new Date(v).toLocaleDateString('fr-FR') : '—'
    },
    size: 140,
  },
  { accessorKey: 'nbUpdated', header: 'Modifs', size: 80 },
  { accessorKey: 'nbAvailabilityUpdated', header: 'Maj dispos', size: 90 },
  { accessorKey: 'nbCreated', header: 'Créations', size: 80 },
  { accessorKey: 'nbAccommodations', header: 'Résidences', size: 90 },
  { accessorKey: 'nbDepublished', header: 'Dépubliées', size: 90 },
]

type AccommodationRow = {
  id: number
  name: string
  slug: string
  published: boolean | null
  createdAt: Date | null
  updatedAt: Date | null
}

const accommodationColumns: ColumnDef<AccommodationRow, unknown>[] = [
  { accessorKey: 'name', header: 'Nom', size: 250 },
  {
    accessorKey: 'published',
    header: 'Statut',
    cell: ({ getValue }) => {
      const published = getValue() as boolean | null
      return (
        <span className={published ? pageStyles.badgePublished : pageStyles.badgeUnpublished}>{published ? 'Publiée' : 'Non publiée'}</span>
      )
    },
    size: 120,
  },
  {
    accessorKey: 'createdAt',
    header: 'Créée le',
    cell: ({ getValue }) => {
      const v = getValue() as Date | null
      return v ? new Date(v).toLocaleDateString('fr-FR') : '—'
    },
    size: 120,
  },
  {
    accessorKey: 'updatedAt',
    header: 'Modifiée le',
    cell: ({ getValue }) => {
      const v = getValue() as Date | null
      return v ? new Date(v).toLocaleDateString('fr-FR') : '—'
    },
    size: 120,
  },
]

export default function GestionnairesStatsPage() {
  const [qs, setQs] = useQueryStates({
    preset: parseAsStringLiteral(PRESETS).withDefault('30'),
    from: parseAsString.withDefault(''),
    to: parseAsString.withDefault(''),
    owner: parseAsInteger,
    search: parseAsString.withDefault(''),
  })

  const range = useMemo(() => {
    if (qs.from && qs.to) return { from: qs.from, to: qs.to }
    const days = qs.preset === '7' ? 7 : qs.preset === '30' ? 30 : 90
    return { from: getDateFrom(days), to: getDateFrom(0) }
  }, [qs.preset, qs.from, qs.to])

  const handlePreset = (p: Preset) => {
    setQs({ preset: p, from: '', to: '' })
  }

  const selectedOwnerId = qs.owner
  const setSelectedOwnerId = (id: number | null) => setQs({ owner: id })
  const searchFilter = qs.search

  const { list, globalEvents } = useOwnerUsage(range)
  const allOwners = list.data ?? []
  const ownersList = searchFilter ? allOwners.filter((o) => o.name.toLowerCase().includes(searchFilter.toLowerCase())) : allOwners
  const selectedOwner = ownersList.find((o) => o.id === selectedOwnerId)

  const totalLogins = ownersList.reduce((s, o) => s + o.nbLogins, 0)
  const totalCreated = ownersList.reduce((s, o) => s + o.nbCreated, 0)
  const activeOwners = ownersList.filter((o) => o.nbLogins > 0 || o.nbActions > 0).length

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-bar-chart-box-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Usage gestionnaires</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">Suivi de l&apos;activite de l&apos;Espace Gestionnaire</p>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className="fr-p-2w">
          <div className={statStyles.dateRangeBar}>
            <input
              type="text"
              placeholder="Filtrer par gestionnaire..."
              value={searchFilter}
              onChange={(e) => setQs({ search: e.target.value || '' })}
              className={statStyles.dateInput}
              style={{ width: '220px' }}
            />
            <div className={statStyles.dateRangePresets}>
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={qs.preset === p && !qs.from ? statStyles.dateRangePresetActive : statStyles.dateRangePreset}
                  onClick={() => handlePreset(p)}
                >
                  {p} jours
                </button>
              ))}
            </div>
            <div className={statStyles.dateInputs}>
              <input
                type="date"
                className={statStyles.dateInput}
                value={qs.from || range.from}
                onChange={(e) => {
                  setQs({ from: e.target.value, to: qs.to || range.to })
                }}
              />
              <span className="fr-text--sm fr-mb-0">—</span>
              <input
                type="date"
                className={statStyles.dateInput}
                value={qs.to || range.to}
                onChange={(e) => setQs({ to: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={clsx(styles.statsGrid, 'fr-mb-3w')}>
        <div className={clsx(styles.statCard, styles.statCardBlue)}>
          <div className={styles.statLabel}>Gestionnaires actifs</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{list.isLoading ? '-' : activeOwners}</div>
          <span className={clsx('fr-icon-building-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardGreen)}>
          <div className={styles.statLabel}>Total connexions</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{list.isLoading ? '-' : totalLogins}</div>
          <span className={clsx('fr-icon-login-box-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardOrange)}>
          <div className={styles.statLabel}>Résidences créées</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{list.isLoading ? '-' : totalCreated}</div>
          <span className={clsx('fr-icon-home-4-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardPurple)}>
          <div className={styles.statLabel}>Demandes d&apos;aide</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{globalEvents.isLoading ? '-' : (globalEvents.data?.contactEquipe ?? 0)}</div>
          <span className={clsx('fr-icon-question-line', styles.statIcon)} aria-hidden="true" />
        </div>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Gestionnaires ({ownersList.length})</span>
        </div>
        <div className="fr-px-2w">
          <AdminDataTable
            columns={ownerColumns}
            data={ownersList}
            pageCount={1}
            page={1}
            isLoading={list.isLoading}
            hidePagination
            onRowClick={(row) => setSelectedOwnerId(selectedOwnerId === row.id ? null : row.id)}
            isRowSelected={(row) => row.id === selectedOwnerId}
          />
        </div>
      </div>

      {selectedOwnerId && selectedOwner && <OwnerDetail ownerId={selectedOwnerId} ownerName={selectedOwner.name} range={range} />}

      {globalEvents.data && globalEvents.data.gestEvents.length > 0 && (
        <div className={clsx(styles.card, 'fr-mb-3w')}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              Events Espace Gestionnaire (global) — {globalEvents.data.consulterOffre}&nbsp;clics &quot;découvrir l&apos;offre&quot;
            </span>
          </div>
          <div className={statStyles.chartContainerTall}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={globalEvents.data.gestEvents}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default-grey)" />
                <XAxis dataKey="action" fontSize={10} angle={-20} textAnchor="end" height={60} interval={0} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="nbEvents" name="Events" fill="#000091" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  )
}

function OwnerDetail({ ownerId, ownerName, range }: { ownerId: number; ownerName: string; range: { from: string; to: string } }) {
  const { data, isLoading } = useOwnerUsageDetail(ownerId, range)

  if (isLoading) return <div className={statStyles.noData}>Chargement...</div>
  if (!data) return null

  const allDates = new Set([...data.loginsByDay.map((d) => d.date), ...data.actionsByDay.map((d) => d.date)])
  const loginMap = new Map(data.loginsByDay.map((d) => [d.date, d.count]))
  const actionMap = new Map(data.actionsByDay.map((d) => [d.date, d.count]))
  const correlationData = Array.from(allDates)
    .sort()
    .map((date) => ({
      date,
      connexions: loginMap.get(date) ?? 0,
      modifications: actionMap.get(date) ?? 0,
    }))

  return (
    <div className={pageStyles.detailSection}>
      <h2 className="fr-h5 fr-mb-2w">{ownerName}</h2>

      <div className={clsx(styles.grid2, 'fr-mb-3w')}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Connexions vs modifications</span>
          </div>
          <div className={statStyles.chartContainer}>
            {correlationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={correlationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default-grey)" />
                  <XAxis dataKey="date" tickFormatter={formatChartDate} fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip labelFormatter={(v) => `Date: ${v}`} />
                  <Legend />
                  <Line type="monotone" dataKey="connexions" name="Connexions" stroke="#000091" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="modifications" name="Modifications" stroke="#e8944a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className={statStyles.noData}>Aucune donnée</div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Activité récente</span>
          </div>
          <div className={pageStyles.activityList}>
            {data.recentActivity.length > 0 ? (
              data.recentActivity.map((item) => <ActivityItem key={item.id} item={item} />)
            ) : (
              <div className={statStyles.noData}>Aucune activité</div>
            )}
          </div>
        </div>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Résidences ({data.accommodations.length})</span>
        </div>
        <div className="fr-px-2w">
          <AdminDataTable columns={accommodationColumns} data={data.accommodations} pageCount={1} page={1} hidePagination />
        </div>
      </div>
    </div>
  )
}
