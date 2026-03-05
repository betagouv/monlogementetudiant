'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/server/trpc/client'

const cardStyles = [
  { bg: 'var(--background-action-low-blue-france)', iconColor: 'var(--text-action-high-blue-france)' },
  { bg: 'var(--background-contrast-info)', iconColor: 'var(--text-default-info)' },
  { bg: 'var(--background-contrast-success)', iconColor: 'var(--text-default-success)' },
  { bg: 'var(--background-contrast-warning)', iconColor: 'var(--text-default-warning)' },
]

export const StatsOverviewCards = () => {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.admin.stats.overview.queryOptions())

  if (isLoading) {
    return (
      <div className="fr-grid-row fr-grid-row--gutters">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="fr-col-md-3 fr-col-6">
            <div className="fr-p-3w" style={{ background: 'var(--background-alt-grey)', borderRadius: '8px' }}>
              <div className="fr-text--bold fr-text--lg">-</div>
              <div className="fr-text--sm fr-text-mention--grey">Chargement...</div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const cards = [
    { label: 'Utilisateurs', value: data?.users.total ?? 0, icon: 'fr-icon-user-line' },
    { label: 'Bailleurs', value: data?.owners ?? 0, icon: 'fr-icon-building-line' },
    { label: 'Residences', value: data?.accommodations ?? 0, icon: 'fr-icon-home-4-line' },
    { label: 'Disponibles', value: data?.availableAccommodations ?? 0, icon: 'fr-icon-checkbox-circle-line' },
  ]

  return (
    <div className="fr-grid-row fr-grid-row--gutters">
      {cards.map((card, i) => {
        const style = cardStyles[i]
        return (
          <div key={card.label} className="fr-col-md-3 fr-col-6">
            <div
              className="fr-p-3w"
              style={{
                background: style.bg,
                borderRadius: '8px',
                transition: 'transform 0.15s ease',
              }}
            >
              <div className="fr-flex fr-flex-gap-2v fr-align-items-center fr-mb-1w">
                <span className={card.icon} aria-hidden="true" style={{ color: style.iconColor, fontSize: '1.5rem' }} />
                <span className="fr-text--bold" style={{ fontSize: '1.75rem', lineHeight: 1 }}>
                  {card.value}
                </span>
              </div>
              <div className="fr-text--sm fr-text-mention--grey">{card.label}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const roleColors: Record<string, string> = {
  Administrateurs: 'var(--text-default-error)',
  Bailleurs: 'var(--text-default-info)',
  Etudiants: 'var(--text-default-success)',
}

export const StatsRoleBreakdown = () => {
  const trpc = useTRPC()
  const { data } = useQuery(trpc.admin.stats.overview.queryOptions())

  if (!data) return null

  const total = data.users.total || 1
  const roles = [
    { label: 'Administrateurs', count: data.users.admins },
    { label: 'Bailleurs', count: data.users.owners },
    { label: 'Etudiants', count: data.users.students },
  ]

  return (
    <div className="fr-p-3w fr-mt-3w" style={{ background: 'var(--background-alt-grey)', borderRadius: '8px' }}>
      <h3 className="fr-text--lg fr-mb-3w">Repartition par role</h3>
      <div className="fr-flex fr-direction-column fr-flex-gap-3v">
        {roles.map((role) => {
          const pct = Math.round((role.count / total) * 100)
          const color = roleColors[role.label] ?? 'var(--text-mention-grey)'
          return (
            <div key={role.label}>
              <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-mb-1v">
                <span className="fr-text--sm fr-text--bold">{role.label}</span>
                <span className="fr-text--sm">
                  {role.count} ({pct}%)
                </span>
              </div>
              <div
                style={{
                  height: '8px',
                  borderRadius: '4px',
                  background: 'var(--background-contrast-grey)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: color,
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
