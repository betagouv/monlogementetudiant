import { cache } from 'react'
import { getMyAccommodations } from '~/server/bailleur/get-my-accommodations'
import { getServerSession } from '~/services/better-auth'

export const getBailleurDashboardPageContext = cache(async (searchParams: { page?: string; ownerId?: string }) => {
  const [session, accommodations] = await Promise.all([
    getServerSession(),
    getMyAccommodations({ page: searchParams.page, ownerId: searchParams.ownerId }),
  ])

  return {
    session,
    accommodations,
  }
})
