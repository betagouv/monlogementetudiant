import { dehydrate, QueryClient } from '@tanstack/react-query'
import { cache } from 'react'
import { getServerSession } from '~/auth'
import { expandBbox } from '~/components/map/map-utils'
import { TTerritories } from '~/schemas/territories'
import { getAccommodationById } from '~/server-only/get-accommodation-by-id'
import { getAccommodations } from '~/server-only/get-accommodations'
import { getCityDetails } from '~/server-only/get-city-details'
import { getTerritories } from '~/server-only/get-territories'
import { prefetchFavorites } from '~/server-only/student/get-favorites'
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

  const cityDetails = await getCityDetails(territory.slug)
  const cityBbox = expandBbox(cityDetails.bbox.xmin, cityDetails.bbox.ymin, cityDetails.bbox.xmax, cityDetails.bbox.ymax)

  const { coordinates } = accommodation.geom
  const [longitude, latitude] = coordinates

  const queryClient = new QueryClient()
  const [nearbyAccommodations] = await Promise.all([
    getAccommodations({ center: `${longitude},${latitude}` }),
    prefetchFavorites(queryClient),
  ])

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
