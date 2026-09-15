import { dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { getAccommodationScope, scopeHasAnyAccommodation } from '~/server/bailleur/accommodation-scope'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { getQueryClient, trpc } from '~/server/trpc/server'
import { buildHref } from '~/utils/preserve-query-params'

type SearchParams = {
  recherche?: string
  ownerId?: string
}

export const getContactsPageContext = cache(async (searchParams: SearchParams) => {
  const ctx = await getBailleurContext(searchParams.ownerId)
  if (!ctx.hasPermission('manage_applications')) redirect(buildHref('/bailleur/tableau-de-bord', searchParams))

  if (!scopeHasAnyAccommodation(await getAccommodationScope(ctx.session.user.id))) {
    redirect(buildHref('/bailleur/tableau-de-bord', searchParams))
  }

  const queryClient = getQueryClient()

  if (ctx.owner.contactMode !== EOwnerContactMode.NONE) {
    const search = searchParams.recherche || undefined
    await queryClient.prefetchQuery(
      trpc.bailleur.listResidencesWithContactCounts.queryOptions({
        search,
        ownerId: searchParams.ownerId ? Number(searchParams.ownerId) : undefined,
      }),
    )
  }

  return {
    dehydratedState: dehydrate(queryClient),
    ctx,
  }
})
