import { dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { getQueryClient, trpc } from '~/server/trpc/server'

type SearchParams = {
  recherche?: string
  ownerId?: string
}

export const getUsersPageContext = cache(async (searchParams: SearchParams) => {
  const ctx = await getBailleurContext(searchParams.ownerId)
  if (!ctx.hasPermission('manage_users')) redirect('/bailleur/tableau-de-bord')

  const queryClient = getQueryClient()
  const search = searchParams.recherche || undefined

  await queryClient.prefetchQuery(trpc.bailleur.users.list.queryOptions({ search, ownerId: ctx.owner.id }))

  return {
    dehydratedState: dehydrate(queryClient),
    ctx,
  }
})
