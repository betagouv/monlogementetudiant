import { cache } from 'react'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { getMyAccommodations } from '~/server/bailleur/get-my-accommodations'
import { getOwnerIncompleteAccommodations } from '~/server/bailleur/get-owner-incomplete-accommodations'
import { getOwnerLastAvailabilityUpdate } from '~/server/bailleur/get-owner-last-availability-update'

export const getBailleurDashboardPageContext = cache(async (searchParams: { page?: string; ownerId?: string }) => {
  const ctx = await getBailleurContext(searchParams.ownerId)
  const [accommodations, lastAvailabilityUpdate, incompleteAccommodations] = await Promise.all([
    getMyAccommodations({ page: searchParams.page, ownerId: searchParams.ownerId }),
    getOwnerLastAvailabilityUpdate(ctx.owner.id),
    ctx.hasPermission('manage_residences') ? getOwnerIncompleteAccommodations(ctx.owner.id) : [],
  ])

  return {
    session: ctx.session,
    accommodations,
    lastAvailabilityUpdate,
    incompleteAccommodations,
    ctx,
  }
})
