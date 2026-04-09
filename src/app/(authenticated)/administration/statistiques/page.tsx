'use client'

import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMatomoStats } from '~/hooks/use-matomo-stats'
import styles from '../administration.module.css'
import pageStyles from './statistiques.module.css'

const COLORS = [
  '#000091',
  '#1f8d49',
  '#e8944a',
  '#a94645',
  '#8585f6',
  '#ce614a',
  '#009081',
  '#a558a0',
  '#417dc4',
  '#716043',
  '#60e0d0',
  '#ff6f61',
]

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}m${secs.toString().padStart(2, '0')}s`
}

function getYesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function getDateFrom(daysAgo: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

type Preset = '7' | '30' | '90'

export default function StatistiquesPage() {
  const [preset, setPreset] = useState<Preset>('30')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const range = useMemo(() => {
    if (customFrom && customTo) return { from: customFrom, to: customTo }
    const days = preset === '7' ? 7 : preset === '30' ? 30 : 90
    return { from: getDateFrom(days), to: getYesterday() }
  }, [preset, customFrom, customTo])

  const handlePreset = (p: Preset) => {
    setPreset(p)
    setCustomFrom('')
    setCustomTo('')
  }

  const [selectedCategory, setSelectedCategory] = useState<string | undefined>()

  const { overview, visitorsOverTime, trends, topPages, topEntryPages, topSources, eventsByCategory, topEventActions } = useMatomoStats(
    range,
    selectedCategory,
  )

  const isLoading = overview.isLoading

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-line-chart-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Statistiques</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">Statistiques Matomo de la plateforme</p>
      </div>

      {/* Date range selector */}
      <div className={clsx(styles.card, 'fr-mb-3w')}>
        <div className="fr-p-2w">
          <div className={pageStyles.dateRangeBar}>
            <div className={pageStyles.dateRangePresets}>
              {(['7', '30', '90'] as Preset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={preset === p && !customFrom ? pageStyles.dateRangePresetActive : pageStyles.dateRangePreset}
                  onClick={() => handlePreset(p)}
                >
                  {p} jours
                </button>
              ))}
            </div>
            <div className={pageStyles.dateInputs}>
              <input
                type="date"
                className={pageStyles.dateInput}
                value={customFrom || range.from}
                onChange={(e) => {
                  setCustomFrom(e.target.value)
                  if (!customTo) setCustomTo(range.to)
                }}
              />
              <span className="fr-text--sm fr-mb-0">—</span>
              <input
                type="date"
                className={pageStyles.dateInput}
                value={customTo || range.to}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={clsx(styles.statsGrid, 'fr-mb-3w')}>
        <div className={clsx(styles.statCard, styles.statCardBlue)}>
          <div className={styles.statLabel}>Visiteurs uniques</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>
            {isLoading ? '-' : (overview.data?.totalVisitors ?? 0).toLocaleString('fr-FR')}
          </div>
          <span className={clsx('fr-icon-user-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardGreen)}>
          <div className={styles.statLabel}>Pages vues</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>
            {isLoading ? '-' : (overview.data?.totalPageViews ?? 0).toLocaleString('fr-FR')}
          </div>
          <span className={clsx('fr-icon-file-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardOrange)}>
          <div className={styles.statLabel}>Taux de rebond</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{isLoading ? '-' : `${Math.round(overview.data?.avgBounceRate ?? 0)}%`}</div>
          <span className={clsx('fr-icon-arrow-go-back-line', styles.statIcon)} aria-hidden="true" />
        </div>
        <div className={clsx(styles.statCard, styles.statCardPurple)}>
          <div className={styles.statLabel}>Durée moyenne</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{isLoading ? '-' : formatDuration(overview.data?.avgDuration ?? 0)}</div>
          <span className={clsx('fr-icon-time-line', styles.statIcon)} aria-hidden="true" />
        </div>
      </div>

      <div className={clsx(styles.grid2, 'fr-mb-3w')}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Visiteurs et pages vues</span>
          </div>
          <div className={pageStyles.chartContainer}>
            {visitorsOverTime.data && visitorsOverTime.data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={visitorsOverTime.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default-grey)" />
                  <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip labelFormatter={(v) => `Date: ${v}`} />
                  <Legend />
                  <Line type="monotone" dataKey="uniqueVisitors" name="Visiteurs" stroke="#000091" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pageViews" name="Pages vues" stroke="#1f8d49" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className={pageStyles.noData}>Aucune donnée sur cette periode</div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Indicateurs moyens</span>
          </div>
          <div className="fr-p-3w">
            {isLoading ? (
              <div className={pageStyles.noData}>Chargement...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {[
                  {
                    label: 'Pages / visiteur',
                    value: (overview.data?.avgVisitorsPerPage ?? 0).toFixed(1),
                    pct: Math.min(100, (overview.data?.avgVisitorsPerPage ?? 0) * 10),
                  },
                  {
                    label: 'Durée moyenne',
                    value: formatDuration(overview.data?.avgDuration ?? 0),
                    pct: Math.min(100, ((overview.data?.avgDuration ?? 0) / 300) * 100),
                  },
                  {
                    label: 'Taux de rebond',
                    value: `${Math.round(overview.data?.avgBounceRate ?? 0)}%`,
                    pct: overview.data?.avgBounceRate ?? 0,
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-1v">
                      <span className="fr-text--sm fr-text--bold fr-mb-0">{item.label}</span>
                      <span className="fr-text--sm fr-mb-0">{item.value}</span>
                    </div>
                    <div className={styles.progressTrack}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${item.pct}%`, background: 'var(--background-action-high-blue-france)' }}
                      />
                    </div>
                  </div>
                ))}
                <div className="fr-text--xs fr-text-mention--grey">Moyennes sur {overview.data?.days ?? 0} jour(s)</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={clsx(styles.grid2, 'fr-mb-3w')}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Taux de rebond</span>
          </div>
          <div className={pageStyles.chartContainer}>
            {trends.data && trends.data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default-grey)" />
                  <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} />
                  <YAxis unit="%" fontSize={11} />
                  <Tooltip labelFormatter={(v) => `Date: ${v}`} formatter={(v) => [`${Math.round(Number(v))}%`, 'Taux de rebond']} />
                  <Line type="monotone" dataKey="bounceRatePercentage" name="Rebond" stroke="#e8944a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className={pageStyles.noData}>Aucune donnée</div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Durée moyenne de visite</span>
          </div>
          <div className={pageStyles.chartContainer}>
            {trends.data && trends.data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default-grey)" />
                  <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} />
                  <YAxis tickFormatter={(v) => formatDuration(v)} fontSize={11} />
                  <Tooltip labelFormatter={(v) => `Date: ${v}`} formatter={(v) => [formatDuration(Number(v)), 'Durée']} />
                  <Line type="monotone" dataKey="averageDuration" name="Durée" stroke="#a94645" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className={pageStyles.noData}>Aucune donnée</div>
            )}
          </div>
        </div>
      </div>

      <div className={clsx(styles.grid2, 'fr-mb-3w')}>
        <HorizontalBarCard title="Top pages" data={topPages.data} />
        <HorizontalBarCard title="Pages d'entrée" data={topEntryPages.data} />
      </div>

      <div className="fr-mb-3w">
        <HorizontalBarCard title="Sources de trafic" data={topSources.data} color="#009081" />
      </div>

      {/* Event category filter */}
      {eventsByCategory.data && eventsByCategory.data.length > 0 && (
        <div className={clsx(styles.card, 'fr-mb-3w')}>
          <div className="fr-p-2w">
            <div className={pageStyles.dateRangeBar}>
              <span className="fr-text--sm fr-text--bold">Categorie :</span>
              <div className={pageStyles.dateRangePresets} style={{ flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={!selectedCategory ? pageStyles.dateRangePresetActive : pageStyles.dateRangePreset}
                  onClick={() => setSelectedCategory(undefined)}
                >
                  Toutes
                </button>
                {eventsByCategory.data.map((cat) => (
                  <button
                    key={cat.category}
                    type="button"
                    className={selectedCategory === cat.category ? pageStyles.dateRangePresetActive : pageStyles.dateRangePreset}
                    onClick={() => setSelectedCategory(selectedCategory === cat.category ? undefined : cat.category)}
                  >
                    {cat.category}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Events by category + Top event actions */}
      <div className={clsx(styles.grid2, 'fr-mb-3w')}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Events par categorie</span>
          </div>
          <div className={pageStyles.chartContainerTall}>
            {eventsByCategory.data && eventsByCategory.data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventsByCategory.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default-grey)" />
                  <XAxis dataKey="category" fontSize={10} angle={-35} textAnchor="end" height={80} interval={0} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar
                    dataKey="nbEvents"
                    name="Events"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data) => {
                      const cat = (data as unknown as { category: string }).category
                      if (cat) setSelectedCategory(selectedCategory === cat ? undefined : cat)
                    }}
                  >
                    {eventsByCategory.data.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={COLORS[i % COLORS.length]}
                        opacity={!selectedCategory || selectedCategory === entry.category ? 1 : 0.3}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={pageStyles.noData}>Aucune donnée</div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Top actions{selectedCategory ? ` — ${selectedCategory}` : ''}</span>
          </div>
          <div className={pageStyles.chartContainerTall}>
            {topEventActions.data && topEventActions.data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topEventActions.data} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default-grey)" />
                  <XAxis type="number" fontSize={11} />
                  <YAxis
                    dataKey="action"
                    type="category"
                    width={140}
                    fontSize={10}
                    tickFormatter={(v) => (v.length > 22 ? `${v.slice(0, 20)}...` : v)}
                  />
                  <Tooltip formatter={(v, _, props) => [v, (props as { payload: { category: string } }).payload.category]} />
                  <Bar dataKey="nbEvents" name="Events" radius={[0, 4, 4, 0]}>
                    {topEventActions.data.map((entry, i) => {
                      const catIndex = eventsByCategory.data?.findIndex((c) => c.category === entry.category) ?? 0
                      return <Cell key={i} fill={COLORS[catIndex >= 0 ? catIndex % COLORS.length : 0]} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={pageStyles.noData}>Aucune donnée</div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function HorizontalBarCard({
  title,
  data,
  color = '#000091',
}: {
  title: string
  data?: { label: string; nbVisits: number }[]
  color?: string
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{title}</span>
      </div>
      <div className={pageStyles.chartContainerTall}>
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default-grey)" />
              <XAxis type="number" fontSize={11} />
              <YAxis
                dataKey="label"
                type="category"
                width={160}
                fontSize={10}
                tickFormatter={(v) => (v.length > 25 ? `${v.slice(0, 23)}...` : v)}
              />
              <Tooltip />
              <Bar dataKey="nbVisits" name="Visites" fill={color} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className={pageStyles.noData}>Aucune donnée</div>
        )}
      </div>
    </div>
  )
}
