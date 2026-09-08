import { dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { isBailleurAdministrator } from '~/server/bailleur/permissions'
import { getQueryClient, trpc } from '~/server/trpc/server'
import { buildHref } from '~/utils/preserve-query-params'

type SearchParams = {
  recherche?: string
  ownerId?: string
}

export const getUsersPageContext = cache(async (searchParams: SearchParams) => {
  const ctx = await getBailleurContext(searchParams.ownerId)
  if (!isBailleurAdministrator(ctx.user)) redirect(buildHref('/bailleur/tableau-de-bord', searchParams))

  const queryClient = getQueryClient()
  const search = searchParams.recherche || undefined

  await queryClient.prefetchQuery(trpc.bailleur.users.list.queryOptions({ search, ownerId: ctx.owner.id }))

  return {
    dehydratedState: dehydrate(queryClient),
    ctx,
  }
})
