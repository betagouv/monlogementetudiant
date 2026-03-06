'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import clsx from 'clsx'
import { Cell, Label, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { useAdminStats } from '~/hooks/use-admin-stats'
import { sPluriel } from '~/utils/sPluriel'
import styles from '../administration.module.css'

export default function DashboardPage() {
  const { data, isLoading } = useAdminStats()

  const students = data?.users.students ?? 0
  const accommodations = data?.accommodations ?? 0
  const availableAccommodations = data?.availableAccommodations ?? 0
  const owners = data?.owners ?? 0

  const statCards = [
    {
      label: `Étudiant${sPluriel(students)} inscrit${sPluriel(students)}`,
      value: students,
      icon: 'fr-icon-user-line',
      colorClass: styles.statCardBlue,
    },
    {
      label: `Résidence${sPluriel(accommodations)}`,
      value: accommodations,
      icon: 'fr-icon-home-4-line',
      colorClass: styles.statCardGreen,
    },
    {
      label: `Logement${sPluriel(availableAccommodations)} disponible${sPluriel(availableAccommodations)}`,
      value: availableAccommodations,
      icon: 'fr-icon-checkbox-circle-line',
      colorClass: styles.statCardOrange,
    },
    {
      label: `Gestionnaire${sPluriel(owners)}`,
      value: owners,
      icon: 'fr-icon-building-line',
      colorClass: styles.statCardPurple,
    },
  ]

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-align-items-center fr-flex-gap-2v">
          <div className={styles.pageIcon}>
            <span className={clsx(styles.pageIconBadge, 'fr-icon-dashboard-3-line')} aria-hidden="true" />
          </div>
          <h1 className="fr-h3 fr-mb-0">Tableau de bord</h1>
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v">Vue d&apos;ensemble de la plateforme Mon Logement Etudiant</p>
      </div>

      <div className={clsx(styles.statsGrid, 'fr-mb-3w')}>
        {statCards.map((card) => (
          <div key={card.label} className={clsx(styles.statCard, card.colorClass)}>
            <div className={styles.statLabel}>{card.label}</div>
            <div className={clsx(styles.statValue, 'fr-mt-1v')}>{isLoading ? '-' : card.value}</div>
            <span className={clsx(card.icon, styles.statIcon)} aria-hidden="true" />
          </div>
        ))}
      </div>

      <div className={clsx(styles.grid2, 'fr-mb-3w')}>
        <RoleBreakdown data={data} />
        <OccupationChart data={data} />
      </div>

      <div className={clsx(styles.grid2, 'fr-mb-3w')}>
        <RecentActivity />
      </div>
    </>
  )
}

function RoleBreakdown({ data }: { data: ReturnType<typeof useAdminStats>['data'] }) {
  if (!data) return null

  const total = data.users.total || 1
  const roles = [
    { label: `Administrateur${sPluriel(data.users.admins)}`, count: data.users.admins, color: 'var(--background-flat-error)' },
    { label: `Gestionnaire${sPluriel(data.users.owners)}`, count: data.users.owners, color: 'var(--background-action-high-blue-france)' },
    { label: `Étudiant${sPluriel(data.users.students)}`, count: data.users.students, color: 'var(--background-flat-success)' },
  ]

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Répartition par role</span>
      </div>
      <div className="fr-p-3w">
        {roles.map((role) => {
          const pct = Math.round((role.count / total) * 100)
          return (
            <div key={role.label} className="fr-mb-2w">
              <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-1v">
                <span className="fr-text--sm fr-text--bold fr-mb-0">{role.label}</span>
                <span className="fr-text--sm fr-mb-0">
                  {role.count} ({pct}%)
                </span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${pct}%`, background: role.color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const OCCUPATION_COLORS = ['#000091', '#e8944a', '#1f8d49']

function OccupationChart({ data }: { data: ReturnType<typeof useAdminStats>['data'] }) {
  if (!data?.occupation) return null

  const { total, occupied, available } = data.occupation
  if (total === 0) return null

  const occupiedPct = Math.round((occupied / total) * 1000) / 10

  const chartData = [
    { name: `Occupé${sPluriel(occupied)}`, value: occupied, color: OCCUPATION_COLORS[0] },
    { name: `Disponible${sPluriel(available)}`, value: available, color: OCCUPATION_COLORS[2] },
  ]

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Occupation des résidences</span>
      </div>
      <div className="fr-p-3w" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <div style={{ width: 180, height: 180, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                innerRadius={55}
                outerRadius={80}
                startAngle={90}
                endAngle={-270}
                paddingAngle={2}
                minAngle={5}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
                <Label
                  position="center"
                  content={() => (
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
                      <tspan x="50%" dy="-0.4em" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                        {occupiedPct}%
                      </tspan>
                      <tspan x="50%" dy="1.4em" style={{ fontSize: '0.75rem', fill: '#666' }}>
                        occupé{sPluriel(occupied)}
                      </tspan>
                    </text>
                  )}
                />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {chartData.map((entry) => {
            const pct = Math.round((entry.value / total) * 1000) / 10
            return (
              <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 12, height: 12, borderRadius: 2, background: entry.color, flexShrink: 0 }} />
                <div>
                  <div className="fr-text--sm fr-text--bold fr-mb-0">
                    {entry.value.toLocaleString('fr-FR')} {entry.name.toLowerCase()}
                  </div>
                  <div className="fr-text--xs fr-text-mention--grey">{pct}%</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function RecentActivity() {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>Activité récente</span>
      </div>
      <div className="fr-m-4w">
        <Alert
          severity="info"
          title="Section en cours de développement"
          description="La gestion des activités sera disponible prochainement."
          className="fr-mb-3w"
        />
      </div>
    </div>
  )
}
