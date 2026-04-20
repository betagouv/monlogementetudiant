import { cache } from 'react'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { getMyAccommodations } from '~/server/bailleur/get-my-accommodations'

export const getBailleurDashboardPageContext = cache(async (searchParams: { page?: string; ownerId?: string }) => {
  const ctx = await getBailleurContext(searchParams.ownerId)
  const accommodations = await getMyAccommodations({ page: searchParams.page, ownerId: searchParams.ownerId })

  return {
    session: ctx.session,
    accommodations,
    ctx,
  }
})
