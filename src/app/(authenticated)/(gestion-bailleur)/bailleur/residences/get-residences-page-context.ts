import { dehydrate } from '@tanstack/react-query'
import { cache } from 'react'
import { prefetchMyAccommodations } from '~/server-only/bailleur/get-my-accommodations'

export const getResidencesPageContext = cache(async (searchParams: { page?: string; disponible?: string; recherche?: string }) => {
  const queryClient = await prefetchMyAccommodations(searchParams)

  return {
    dehydratedState: dehydrate(queryClient),
  }
})
