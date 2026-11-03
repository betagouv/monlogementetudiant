import { dehydrate } from '@tanstack/react-query'
import { cache } from 'react'
import { expandBbox } from '~/components/map/map-utils'
import { getAccommodationById } from '~/server/accommodations/get-accommodation-by-id'
import { getAccommodations } from '~/server/accommodations/get-accommodations'
import { getQueryClient, trpc } from '~/server/trpc/server'
import { getServerSession } from '~/services/better-auth'
import { calculateAvailability } from '~/utils/calculateAvailability'

export const getAccommodationPageContext = cache(async (slug: string) => {
  const [accommodation, session] = await Promise.all([getAccommodationById(slug), getServerSession()])

  const cityBbox = expandBbox(
    accommodation.cityBbox.xmin,
    accommodation.cityBbox.ymin,
    accommodation.cityBbox.xmax,
    accommodation.cityBbox.ymax,
  )

  const longitude = accommodation.longitude ?? 0
  const latitude = accommodation.latitude ?? 0

  const queryClient = getQueryClient()
  const prefetchPromises: Promise<unknown>[] = []
  if (session?.user.role === 'user') {
    prefetchPromises.push(queryClient.prefetchQuery(trpc.favorites.list.queryOptions()))
  }
  if (session) {
    prefetchPromises.push(
      queryClient.prefetchQuery(trpc.dossierFacile.tenant.queryOptions()),
      queryClient.prefetchQuery(trpc.dossierFacile.listApplications.queryOptions({ accommodationSlug: slug })),
    )
  }
  const [nearbyAccommodations] = await Promise.all([getAccommodations({ center: `${longitude},${latitude}` }), ...prefetchPromises])

  const nbAvailable = calculateAvailability(accommodation.typologies)

  return {
    accommodation,
    cityBbox,
    dehydratedState: dehydrate(queryClient),
    latitude,
    longitude,
    nbAvailable,
    nearbyAccommodations,
    user: session?.user,
  }
})
