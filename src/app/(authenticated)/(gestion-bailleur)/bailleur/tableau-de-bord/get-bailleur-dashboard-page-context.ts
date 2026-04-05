import { cache } from 'react'
import { getMyAccommodations } from '~/server/bailleur/get-my-accommodations'
import { getServerSession } from '~/services/better-auth'

export const getBailleurDashboardPageContext = cache(async (searchParams: { page?: string; bailleur?: string }) => {
  const [session, accommodations] = await Promise.all([
    getServerSession(),
    getMyAccommodations({ page: searchParams.page, bailleur: searchParams.bailleur }),
  ])

  return {
    session,
    accommodations,
  }
})
