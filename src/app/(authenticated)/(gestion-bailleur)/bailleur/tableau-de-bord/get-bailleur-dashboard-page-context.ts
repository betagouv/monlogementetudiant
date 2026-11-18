import { cache } from 'react'
import { getAccommodationScope } from '~/server/bailleur/accommodation-scope'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { getMyAccommodations } from '~/server/bailleur/get-my-accommodations'
import { getOwnerIncompleteAccommodations } from '~/server/bailleur/get-owner-incomplete-accommodations'
import { getOwnerLastAvailabilityUpdate } from '~/server/bailleur/get-owner-last-availability-update'
import { isSurveyPendingForUser } from '~/server/scholarship-survey/service'

export const getBailleurDashboardPageContext = cache(async (searchParams: { page?: string; ownerId?: string }) => {
  const ctx = await getBailleurContext(searchParams.ownerId)
  const [accommodations, lastAvailabilityUpdate, incompleteAccommodations, scholarshipSurveyPending] = await Promise.all([
    getMyAccommodations({ page: searchParams.page, ownerId: searchParams.ownerId }),
    getOwnerLastAvailabilityUpdate(ctx.owner.id),
    ctx.hasPermission('manage_residences') ? getOwnerIncompleteAccommodations(ctx.owner.id) : [],
    ctx.hasPermission('manage_residences')
      ? getAccommodationScope(ctx.session.user.id).then((scope) => isSurveyPendingForUser(ctx.owner.id, scope))
      : false,
  ])

  return {
    session: ctx.session,
    accommodations,
    lastAvailabilityUpdate,
    incompleteAccommodations,
    scholarshipSurveyPending,
    ctx,
  }
})
