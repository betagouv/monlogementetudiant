import { cache } from 'react'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { getMyAccommodations } from '~/server/bailleur/get-my-accommodations'
import { getOwnerLastAvailabilityUpdate } from '~/server/bailleur/get-owner-last-availability-update'

export const getBailleurDashboardPageContext = cache(async (searchParams: { page?: string; ownerId?: string }) => {
  const ctx = await getBailleurContext(searchParams.ownerId)
  const [accommodations, lastAvailabilityUpdate] = await Promise.all([
    getMyAccommodations({ page: searchParams.page, ownerId: searchParams.ownerId }),
    getOwnerLastAvailabilityUpdate(ctx.owner.id),
  ])

  return {
    session: ctx.session,
    accommodations,
    lastAvailabilityUpdate,
    ctx,
  }
})
