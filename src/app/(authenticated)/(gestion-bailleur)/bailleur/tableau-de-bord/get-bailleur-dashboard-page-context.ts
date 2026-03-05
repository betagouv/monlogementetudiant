import { cache } from 'react'
import { getMyAccommodations } from '~/server/bailleur/get-my-accommodations'
import { getServerSession } from '~/services/better-auth'

export const getBailleurDashboardPageContext = cache(async (searchParams: { page?: string }) => {
  const [session, accommodations] = await Promise.all([getServerSession(), getMyAccommodations({ page: searchParams.page })])

  return {
    session,
    accommodations,
  }
})
