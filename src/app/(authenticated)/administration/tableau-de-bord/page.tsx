import { StatsOverviewCards, StatsRoleBreakdown } from '~/components/administration/stats-overview-cards'

export default function DashboardPage() {
  console.log('dashboard')
  return (
    <>
      <h1 className="fr-h3 fr-mb-3w">Tableau de bord</h1>
      <StatsOverviewCards />
      <StatsRoleBreakdown />
    </>
  )
}
