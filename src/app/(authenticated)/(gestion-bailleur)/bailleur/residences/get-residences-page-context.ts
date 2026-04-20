import { dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { prefetchMyAccommodations } from '~/server/bailleur/get-my-accommodations'

export const getResidencesPageContext = cache(
  async (searchParams: { page?: string; disponible?: string; recherche?: string; ownerId?: string }) => {
    const ctx = await getBailleurContext(searchParams.ownerId)
    if (!ctx.hasPermission('manage_residences')) redirect('/bailleur/tableau-de-bord')

    const queryClient = await prefetchMyAccommodations(searchParams)

    return {
      dehydratedState: dehydrate(queryClient),
      ctx,
    }
  },
)
