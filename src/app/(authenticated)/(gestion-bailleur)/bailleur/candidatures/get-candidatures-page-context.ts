import { dehydrate } from '@tanstack/react-query'
import { cache } from 'react'
import { getQueryClient, trpc } from '~/server/trpc/server'

type SearchParams = {
  page?: string
  status?: string
  recherche?: string
  tri?: string
}

export const getCandidaturesPageContext = cache(async (searchParams: SearchParams) => {
  const queryClient = getQueryClient()

  const page = searchParams.page ? Number(searchParams.page) : 1
  const status = searchParams.status as 'pending' | 'accepted' | 'rejected' | undefined
  const search = searchParams.recherche || undefined
  const sort = (searchParams.tri as 'date_desc' | 'date_asc') || 'date_desc'

  await queryClient.prefetchQuery(trpc.bailleur.listCandidatures.queryOptions({ page, status, search, sort }))

  return {
    dehydratedState: dehydrate(queryClient),
  }
})
