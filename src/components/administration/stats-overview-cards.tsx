'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/server/trpc/client'

export const StatsOverviewCards = () => {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.admin.stats.overview.queryOptions())

  if (isLoading) {
    return (
      <div className="fr-grid-row fr-grid-row--gutters">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="fr-col-md-3 fr-col-6">
            <div className="fr-card fr-card--no-border fr-p-3w">
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
      {cards.map((card) => (
        <div key={card.label} className="fr-col-md-3 fr-col-6">
          <div className="fr-card fr-card--no-border fr-p-3w">
            <div className="fr-flex fr-flex-gap-2v fr-align-items-center fr-mb-1w">
              <span className={card.icon} aria-hidden="true" />
              <span className="fr-text--bold fr-text--lg">{card.value}</span>
            </div>
            <div className="fr-text--sm fr-text-mention--grey">{card.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export const StatsRoleBreakdown = () => {
  const trpc = useTRPC()
  const { data } = useQuery(trpc.admin.stats.overview.queryOptions())

  if (!data) return null

  const roles = [
    { label: 'Administrateurs', count: data.users.admins, color: 'var(--text-default-error)' },
    { label: 'Bailleurs', count: data.users.owners, color: 'var(--text-default-info)' },
    { label: 'Etudiants', count: data.users.students, color: 'var(--text-default-success)' },
  ]

  return (
    <div className="fr-card fr-card--no-border fr-p-3w fr-mt-3w">
      <h3 className="fr-text--lg fr-mb-2w">Repartition par role</h3>
      <div className="fr-flex fr-direction-column fr-flex-gap-2v">
        {roles.map((role) => (
          <div key={role.label} className="fr-flex fr-justify-content-space-between fr-align-items-center">
            <span className="fr-text--sm">{role.label}</span>
            <span className="fr-text--bold">{role.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
