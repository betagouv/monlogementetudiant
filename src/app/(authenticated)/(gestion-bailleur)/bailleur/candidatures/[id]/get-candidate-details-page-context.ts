import { dehydrate } from '@tanstack/react-query'
import { cache } from 'react'
import { getQueryClient, trpc } from '~/server/trpc/server'

export const getCandidateDetailsPageContext = cache(async (id: string) => {
  const queryClient = getQueryClient()

  await queryClient.prefetchQuery(trpc.bailleur.getCandidature.queryOptions({ id }))

  return {
    dehydratedState: dehydrate(queryClient),
  }
})
