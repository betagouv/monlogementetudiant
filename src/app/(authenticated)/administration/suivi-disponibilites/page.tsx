'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import { Table } from '@codegouvfr/react-dsfr/Table'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Pagination } from '~/components/ui/pagination'
import type { OwnerFollowUpRow, OwnerSegment } from '~/server/admin/availability-follow-up'
import { useTRPC } from '~/server/trpc/client'
import { formatRecentSince } from '~/utils/availability-freshness'
import styles from '../administration.module.css'

const SEGMENT_META: Record<OwnerSegment, { label: string; severity: 'success' | 'warning' | 'error' }> = {
  good: { label: 'Bon élève', severity: 'success' },
  irregular: { label: 'Irrégulier', severity: 'warning' },
  bad: { label: 'Mauvais élève', severity: 'error' },
}

const SEGMENT_ORDER: OwnerSegment[] = ['good', 'irregular', 'bad']

const SEGMENT_SERIES: Record<OwnerSegment, { label: string; color: string }> = {
  good: { label: 'Bons élèves', color: '#1f8d49' },
  irregular: { label: 'Irréguliers', color: '#e8944a' },
  bad: { label: 'Mauvais élèves', color: '#a94645' },
}

// Les relevés antérieurs suivaient l'ancienne règle (30 jours glissants, comptés en heures).
const RULE_31_DAYS_FIRST_SNAPSHOT = '2026-12-01'

const UNASSIGNED = 'unassigned'
type AdminFilter = 'all' | typeof UNASSIGNED | string

const matchesAdmin = (adminIds: string[], filter: AdminFilter) =>
  filter === 'all' || (filter === UNASSIGNED ? adminIds.length === 0 : adminIds.includes(filter))

const monthLabel = (capturedOn: string) => new Date(capturedOn).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })

const OWNERS_PAGE_SIZE = 15

const fmt = (n: number) => n.toLocaleString('fr-FR')
const pct = (part: number, total: number) =>
  `${(total ? (part / total) * 100 : 0).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`

function ownerTotals(row: OwnerFollowUpRow) {
  return {
    apartments: row.recent.apartments + row.stale.apartments + row.missing.apartments,
    residences: row.recent.residences + row.stale.residences + row.missing.residences,
    apartmentsApi: row.recent.apartmentsApi + row.stale.apartmentsApi + row.missing.apartmentsApi,
  }
}

function ownerSource(row: OwnerFollowUpRow): string {
  const { apartments, apartmentsApi } = ownerTotals(row)
  if (apartments === 0) return '—'
  if (apartmentsApi === apartments) return 'API'
  if (apartmentsApi === 0) return 'Manuelle'
  return 'Mixte'
}

function downloadOwnersCsv(rows: OwnerFollowUpRow[], adminNames: Map<string, string>) {
  const header = [
    'Gestionnaire',
    'Suivi par',
    'Segment',
    'Source',
    'Logements à jour',
    'Logements màj irrégulière',
    'Logements jamais renseignés',
    'Logements total',
    'Part logements à jour (%)',
    'Résidences à jour',
    'Résidences màj irrégulière',
    'Résidences jamais renseignées',
    'Résidences total',
  ]
  const lines = rows.map((row) => {
    const totals = ownerTotals(row)
    const share = totals.apartments ? ((row.recent.apartments / totals.apartments) * 100).toFixed(1).replace('.', ',') : '0'
    return [
      `"${row.ownerName.replaceAll('"', '""')}"`,
      `"${row.adminIds.map((id) => adminNames.get(id) ?? id).join(', ') || 'Non attribué'}"`,
      SEGMENT_META[row.segment].label,
      ownerSource(row),
      row.recent.apartments,
      row.stale.apartments,
      row.missing.apartments,
      totals.apartments,
      share,
      row.recent.residences,
      row.stale.residences,
      row.missing.residences,
      totals.residences,
    ].join(';')
  })
  // BOM UTF-8 pour qu'Excel détecte l'encodage
  const blob = new Blob(['﻿', [header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `suivi-disponibilites-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function SuiviDisponibilitesPage() {
  const trpc = useTRPC()
  const byOwner = useQuery(trpc.admin.availability.byOwner.queryOptions())
  const followUp = useQuery(trpc.admin.availability.followUp.queryOptions())
  const snapshots = useQuery(trpc.admin.availability.snapshots.queryOptions())
  const admins = useQuery(trpc.admin.availability.admins.queryOptions())

  const [adminFilter, setAdminFilter] = useState<AdminFilter>('all')
  const [segmentFilter, setSegmentFilter] = useState<OwnerSegment | 'all'>('all')
  const [page, setPage] = useState(1)

  const allRows = useMemo(() => byOwner.data ?? [], [byOwner.data])
  const adminNames = useMemo(() => new Map((admins.data ?? []).map((admin) => [admin.id, admin.name])), [admins.data])
  const rows = useMemo(() => allRows.filter((row) => matchesAdmin(row.adminIds, adminFilter)), [allRows, adminFilter])
  const filteredRows = segmentFilter === 'all' ? rows : rows.filter((row) => row.segment === segmentFilter)
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / OWNERS_PAGE_SIZE))
  const pagedRows = filteredRows.slice((page - 1) * OWNERS_PAGE_SIZE, page * OWNERS_PAGE_SIZE)

  const selectSegment = (segment: OwnerSegment | 'all') => {
    setSegmentFilter(segment)
    setPage(1)
  }

  const selectAdmin = (filter: AdminFilter) => {
    setAdminFilter(filter)
    setSegmentFilter('all')
    setPage(1)
  }

  const adminFilterOptions = [
    { value: 'all', label: 'Tous', count: allRows.length },
    ...(admins.data ?? []).map((admin) => ({
      value: admin.id,
      label: admin.name,
      count: allRows.filter((row) => row.adminIds.includes(admin.id)).length,
    })),
    { value: UNASSIGNED, label: 'Non attribué', count: allRows.filter((row) => row.adminIds.length === 0).length },
  ]

  const totals = useMemo(() => {
    const sum = { recent: 0, stale: 0, missing: 0, recentApi: 0, staleApi: 0, missingApi: 0, residences: 0 }
    const residences = { recent: 0, stale: 0, missing: 0 }
    for (const row of rows) {
      sum.recent += row.recent.apartments
      sum.stale += row.stale.apartments
      sum.missing += row.missing.apartments
      sum.recentApi += row.recent.apartmentsApi
      sum.staleApi += row.stale.apartmentsApi
      sum.missingApi += row.missing.apartmentsApi
      residences.recent += row.recent.residences
      residences.stale += row.stale.residences
      residences.missing += row.missing.residences
    }
    const apartments = sum.recent + sum.stale + sum.missing
    const residencesTotal = residences.recent + residences.stale + residences.missing
    return { ...sum, residences, apartments, residencesTotal }
  }, [rows])

  const segmentCounts = useMemo(() => {
    const counts: Record<OwnerSegment, number> = { good: 0, irregular: 0, bad: 0 }
    for (const row of rows) counts[row.segment] += 1
    return counts
  }, [rows])

  // Les relevés sont filtrés selon les liens admin ↔ gestionnaire actuels (les liens ne sont pas historisés).
  const snapshotPoints = useMemo(() => {
    const adminIdsByOwner = new Map(allRows.map((row) => [row.ownerId, row.adminIds]))
    const byDate = new Map<string, { recent: number; stale: number; missing: number; segments: Record<OwnerSegment, number> }>()
    for (const row of snapshots.data ?? []) {
      if (!matchesAdmin(adminIdsByOwner.get(row.ownerId) ?? [], adminFilter)) continue
      const point = byDate.get(row.capturedOn) ?? { recent: 0, stale: 0, missing: 0, segments: { good: 0, irregular: 0, bad: 0 } }
      point.recent += row.recentApartments
      point.stale += row.staleApartments
      point.missing += row.missingApartments
      point.segments[row.segment] += 1
      byDate.set(row.capturedOn, point)
    }
    return [...byDate.entries()].map(([capturedOn, point]) => ({ capturedOn, ...point }))
  }, [snapshots.data, allRows, adminFilter])

  const chartData = snapshotPoints.map((point) => {
    const total = point.recent + point.stale + point.missing
    const share = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0)
    return {
      date: monthLabel(point.capturedOn),
      'À jour': share(point.recent),
      'Màj irrégulière': share(point.stale),
      'Jamais renseignée': share(point.missing),
    }
  })

  const segmentChartData = snapshotPoints.map((point) => ({
    date: monthLabel(point.capturedOn),
    ...Object.fromEntries(SEGMENT_ORDER.map((segment) => [SEGMENT_SERIES[segment].label, point.segments[segment]])),
  }))

  const hasLegacySnapshots = snapshotPoints.some((point) => point.capturedOn < RULE_31_DAYS_FIRST_SNAPSHOT)

  const isLoading = byOwner.isLoading

  const situationRows = [
    {
      label: 'Disponibilité mise à jour récemment',
      apartments: totals.recent,
      api: totals.recentApi,
      residences: totals.residences.recent,
    },
    {
      label: 'Disponibilité renseignée, mais pas récemment',
      apartments: totals.stale,
      api: totals.staleApi,
      residences: totals.residences.stale,
    },
    {
      label: 'Aucune disponibilité jamais renseignée',
      apartments: totals.missing,
      api: totals.missingApi,
      residences: totals.residences.missing,
    },
  ]

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-refresh-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Suivi des disponibilités</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v fr-mb-0">
          Mise à jour des disponibilités sur les résidences publiées hors CROUS, par un gestionnaire ou par l&apos;import automatique des
          API (ARPEJ, Fac-Habitat, Initiall). « À jour » : mise à jour dans les 31 derniers jours
          {followUp.data ? `, soit depuis le ${formatRecentSince(followUp.data.recentSince)}` : ''}. 31 jours plutôt que 30 : un
          gestionnaire qui met à jour une fois par mois, à date fixe, n&apos;est jamais pénalisé par un mois de 31 jours.
        </p>
      </div>

      <fieldset className="fr-fieldset fr-mb-2w" aria-labelledby="suivi-par-legend">
        <legend id="suivi-par-legend" className="fr-text--sm fr-text--bold fr-mb-1w">
          Gestionnaires suivis par
        </legend>
        <ul className="fr-tags-group">
          {adminFilterOptions.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                className="fr-tag"
                aria-pressed={adminFilter === option.value}
                onClick={() => selectAdmin(option.value)}
              >
                {option.label} ({option.count})
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className={clsx(styles.statsGrid, 'fr-mb-3w')}>
        <div className={clsx(styles.statCard, styles.statCardGreen)}>
          <div className={styles.statLabel}>Logements à jour</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{isLoading ? '-' : pct(totals.recent, totals.apartments)}</div>
          <span className={clsx('fr-icon-checkbox-circle-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardOrange)}>
          <div className={styles.statLabel}>Logements en màj irrégulière</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{isLoading ? '-' : pct(totals.stale, totals.apartments)}</div>
          <span className={clsx('fr-icon-time-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardRed)}>
          <div className={styles.statLabel}>Logements jamais renseignés</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{isLoading ? '-' : pct(totals.missing, totals.apartments)}</div>
          <span className={clsx('fr-icon-question-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardBlue)}>
          <div className={styles.statLabel}>Gestionnaires</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{isLoading ? '-' : fmt(rows.length)}</div>
          <div className="fr-text--xs fr-text-mention--grey fr-mb-0">
            {isLoading ? '' : `${segmentCounts.good} bons · ${segmentCounts.irregular} irréguliers · ${segmentCounts.bad} mauvais`}
          </div>
          <span className={clsx('fr-icon-building-line', styles.statIcon)} aria-hidden="true" />
        </div>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Vue d&apos;ensemble du parc</span>
        </div>
        <div className="fr-px-3w fr-pb-2w">
          {isLoading ? (
            <p className="fr-text--sm fr-text-mention--grey fr-py-3w fr-mb-0">Chargement...</p>
          ) : (
            <Table
              fixed
              noCaption
              caption="Vue d'ensemble du parc"
              className="fr-mb-0"
              headers={['Situation', 'Nb logements', 'Part des logements', 'Dont via API', 'Nb résidences', 'Part des résidences']}
              data={[
                ...situationRows.map((row) => [
                  row.label,
                  fmt(row.apartments),
                  pct(row.apartments, totals.apartments),
                  pct(row.api, row.apartments),
                  fmt(row.residences),
                  pct(row.residences, totals.residencesTotal),
                ]),
                [
                  <strong key="label">Total</strong>,
                  <strong key="apartments">{fmt(totals.apartments)}</strong>,
                  <strong key="pct">100 %</strong>,
                  <strong key="api">{pct(totals.recentApi + totals.staleApi + totals.missingApi, totals.apartments)}</strong>,
                  <strong key="residences">{fmt(totals.residencesTotal)}</strong>,
                  <strong key="pctResidences">100 %</strong>,
                ],
              ]}
            />
          )}
        </div>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Progression mensuelle (part des logements)</span>
        </div>
        <div className="fr-px-3w fr-py-2w">
          {chartData.length === 0 ? (
            <p className="fr-text--sm fr-text-mention--grey fr-mb-0">
              Aucun relevé pour le moment : la courbe se construit au fil des relevés automatiques, le 1er de chaque mois.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis unit=" %" fontSize={12} domain={[0, 100]} />
                <Tooltip formatter={(value) => `${value} %`} />
                <Legend />
                <Line type="monotone" dataKey="À jour" stroke="#1f8d49" strokeWidth={2} dot />
                <Line type="monotone" dataKey="Màj irrégulière" stroke="#e8944a" strokeWidth={2} dot />
                <Line type="monotone" dataKey="Jamais renseignée" stroke="#a94645" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Progression mensuelle des gestionnaires (nombre par segment)</span>
        </div>
        <div className="fr-px-3w fr-py-2w">
          {segmentChartData.length === 0 ? (
            <p className="fr-text--sm fr-text-mention--grey fr-mb-0">
              Aucun relevé pour le moment : la courbe se construit au fil des relevés automatiques, le 1er de chaque mois.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={segmentChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Legend />
                {SEGMENT_ORDER.map((segment) => (
                  <Line
                    key={segment}
                    type="monotone"
                    dataKey={SEGMENT_SERIES[segment].label}
                    stroke={SEGMENT_SERIES[segment].color}
                    strokeWidth={2}
                    dot
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
          {hasLegacySnapshots && (
            <p className="fr-text--xs fr-text-mention--grey fr-mt-1w fr-mb-0">
              Les relevés antérieurs à décembre 2026 ont été calculés avec l&apos;ancienne règle (mise à jour dans les 30 derniers jours).
            </p>
          )}
        </div>
      </div>

      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className={styles.cardHeader}>
          <span className={styles.cardTitle}>Détail par gestionnaire</span>
          <Button
            priority="tertiary no outline"
            size="small"
            iconId="fr-icon-download-line"
            disabled={filteredRows.length === 0}
            onClick={() => downloadOwnersCsv(filteredRows, adminNames)}
          >
            Exporter en CSV
          </Button>
        </div>
        <div className="fr-px-3w fr-pb-2w">
          <ul className="fr-tags-group fr-mt-2w">
            <li>
              <button type="button" className="fr-tag" aria-pressed={segmentFilter === 'all'} onClick={() => selectSegment('all')}>
                Tous ({rows.length})
              </button>
            </li>
            {SEGMENT_ORDER.map((segment) => (
              <li key={segment}>
                <button type="button" className="fr-tag" aria-pressed={segmentFilter === segment} onClick={() => selectSegment(segment)}>
                  {SEGMENT_META[segment].label}s ({segmentCounts[segment]})
                </button>
              </li>
            ))}
          </ul>
          <p className="fr-text--xs fr-text-mention--grey fr-mb-0">
            Bon élève : tout le parc renseigné et au moins 80 % à jour · Mauvais élève : aucune disponibilité jamais renseignée · Irrégulier
            : le reste. Chiffres en logements, résidences entre parenthèses.
          </p>
          {isLoading ? (
            <p className="fr-text--sm fr-text-mention--grey fr-py-3w fr-mb-0">Chargement...</p>
          ) : (
            <Table
              noCaption
              caption="Détail par gestionnaire"
              className="fr-mb-0"
              headers={[
                'Gestionnaire',
                'Suivi par',
                'Segment',
                'Source',
                'À jour',
                'Màj irrégulière',
                'Jamais renseignée',
                'Parc total',
                'Part à jour',
              ]}
              data={pagedRows.map((row) => {
                const rowTotals = ownerTotals(row)
                const segment = SEGMENT_META[row.segment]
                return [
                  row.ownerName,
                  row.adminIds.map((id) => adminNames.get(id) ?? id).join(', ') || '—',
                  <Badge key="segment" severity={segment.severity} small>
                    {segment.label}
                  </Badge>,
                  ownerSource(row),
                  `${fmt(row.recent.apartments)} (${fmt(row.recent.residences)})`,
                  `${fmt(row.stale.apartments)} (${fmt(row.stale.residences)})`,
                  `${fmt(row.missing.apartments)} (${fmt(row.missing.residences)})`,
                  `${fmt(rowTotals.apartments)} (${fmt(rowTotals.residences)})`,
                  pct(row.recent.apartments, rowTotals.apartments),
                ]
              })}
            />
          )}
          {pageCount > 1 && (
            <div className="fr-pt-2w fr-flex fr-justify-content-center">
              <Pagination
                count={pageCount}
                defaultPage={page}
                getPageLinkProps={(p) => ({
                  href: '#',
                  onClick: (e: React.MouseEvent) => {
                    e.preventDefault()
                    setPage(p)
                  },
                })}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
