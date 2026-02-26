import { cache } from 'react'
import { getServerSession } from '~/auth'
import { getMyAccommodations } from '~/server-only/bailleur/get-my-accommodations'

export const getBailleurDashboardPageContext = cache(async (searchParams: { page?: string }) => {
  const [session, accommodations] = await Promise.all([getServerSession(), getMyAccommodations({ page: searchParams.page })])

  return {
    session,
    accommodations,
  }
})
