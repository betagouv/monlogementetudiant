import { dehydrate } from '@tanstack/react-query'
import { cache } from 'react'
import { expandBbox } from '~/components/map/map-utils'
import { TTerritories } from '~/schemas/territories'
import { getAccommodationById } from '~/server/accommodations/get-accommodation-by-id'
import { getAccommodations } from '~/server/accommodations/get-accommodations'
import { getTerritories } from '~/server/territories/get-territories'
import { getQueryClient, trpc } from '~/server/trpc/server'
import { getServerSession } from '~/services/better-auth'
import { calculateAvailability } from '~/utils/calculateAvailability'

export const getAccommodationPageContext = cache(async (slug: string, location: string) => {
  const decodedLocationUri = decodeURIComponent(location)

  const [accommodation, session, territories] = await Promise.all([
    getAccommodationById(slug),
    getServerSession(),
    getTerritories(decodedLocationUri),
  ])

  const territory = (territories.cities || []).find(
    (territory) => territory.name === decodedLocationUri || territory.slug === decodedLocationUri,
  ) as TTerritories['cities'][0]

  const cityBbox = expandBbox(territory.bbox.xmin, territory.bbox.ymin, territory.bbox.xmax, territory.bbox.ymax)

  const { coordinates } = accommodation.geom
  const [longitude, latitude] = coordinates

  const queryClient = getQueryClient()
  const prefetchPromises: Promise<unknown>[] = [queryClient.prefetchQuery(trpc.favorites.list.queryOptions())]
  if (session) {
    prefetchPromises.push(
      queryClient.prefetchQuery(trpc.dossierFacile.tenant.queryOptions()),
      queryClient.prefetchQuery(trpc.dossierFacile.listApplications.queryOptions({ accommodationSlug: slug })),
    )
  }
  const [nearbyAccommodations] = await Promise.all([getAccommodations({ center: `${longitude},${latitude}` }), ...prefetchPromises])

  const nbAvailable = calculateAvailability({
    nb_t1_available: accommodation.nb_t1_available,
    nb_t1_bis_available: accommodation.nb_t1_bis_available,
    nb_t2_available: accommodation.nb_t2_available,
    nb_t3_available: accommodation.nb_t3_available,
    nb_t4_available: accommodation.nb_t4_available,
    nb_t5_available: accommodation.nb_t5_available,
    nb_t6_available: accommodation.nb_t6_available,
    nb_t7_more_available: accommodation.nb_t7_more_available,
  })

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
