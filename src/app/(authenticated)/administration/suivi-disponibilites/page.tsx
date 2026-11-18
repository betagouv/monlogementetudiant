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
import styles from '../administration.module.css'

const SEGMENT_META: Record<OwnerSegment, { label: string; severity: 'success' | 'warning' | 'error' }> = {
  good: { label: 'Bon élève', severity: 'success' },
  irregular: { label: 'Irrégulier', severity: 'warning' },
  bad: { label: 'Mauvais élève', severity: 'error' },
}

const SEGMENT_ORDER: OwnerSegment[] = ['good', 'irregular', 'bad']

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

function downloadOwnersCsv(rows: OwnerFollowUpRow[]) {
  const header = [
    'Gestionnaire',
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

  const [segmentFilter, setSegmentFilter] = useState<OwnerSegment | 'all'>('all')
  const [page, setPage] = useState(1)

  const rows = useMemo(() => byOwner.data ?? [], [byOwner.data])
  const filteredRows = segmentFilter === 'all' ? rows : rows.filter((row) => row.segment === segmentFilter)
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / OWNERS_PAGE_SIZE))
  const pagedRows = filteredRows.slice((page - 1) * OWNERS_PAGE_SIZE, page * OWNERS_PAGE_SIZE)

  const selectSegment = (segment: OwnerSegment | 'all') => {
    setSegmentFilter(segment)
    setPage(1)
  }

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

  const chartData = useMemo(
    () =>
      (snapshots.data ?? []).map((point) => {
        const total = point.recentApartments + point.staleApartments + point.missingApartments
        const share = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0)
        return {
          date: new Date(point.capturedOn).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
          'À jour': share(point.recentApartments),
          'Màj irrégulière': share(point.staleApartments),
          'Jamais renseignée': share(point.missingApartments),
        }
      }),
    [snapshots.data],
  )

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
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">
          Mise à jour des disponibilités sur les résidences publiées hors CROUS. « À jour » : mise à jour dans les{' '}
          {followUp.data?.recentDays ?? 30} derniers jours, par un gestionnaire ou par l&apos;import automatique des API (ARPEJ,
          Fac-Habitat, Initiall).
        </p>
      </div>

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
          <span className={styles.cardTitle}>Détail par gestionnaire</span>
          <Button
            priority="tertiary no outline"
            size="small"
            iconId="fr-icon-download-line"
            disabled={filteredRows.length === 0}
            onClick={() => downloadOwnersCsv(filteredRows)}
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
              headers={['Gestionnaire', 'Segment', 'Source', 'À jour', 'Màj irrégulière', 'Jamais renseignée', 'Parc total', 'Part à jour']}
              data={pagedRows.map((row) => {
                const rowTotals = ownerTotals(row)
                const segment = SEGMENT_META[row.segment]
                return [
                  row.ownerName,
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
