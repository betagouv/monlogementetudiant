import { dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { getServerSession } from '~/auth'
import { expandBbox } from '~/components/map/map-utils'
import { TTerritories, TTerritory } from '~/schemas/territories'
import { prefetchAccommodations } from '~/server/accommodations/get-accommodations'
import { getTerritories } from '~/server/territories/get-territories'
import { getQueryClient, trpc } from '~/server/trpc/server'

const getTerritoriesCategoryKey = (categoryKey: 'ville' | 'academie' | 'departement') => {
  const keys = {
    academie: 'academies',
    departement: 'departments',
    ville: 'cities',
  }
  return keys[categoryKey] as keyof TTerritories
}

export const getStudentAccommodationPageContext = cache(
  async (awaitedParams: { location: string }, awaitedSearchParams: Record<string, string | string[] | undefined>) => {
    const routeCategoryKey = awaitedParams?.location?.[0] || ''
    const routeLocation = decodeURIComponent(awaitedParams?.location?.[1] || '')

    if (awaitedParams && (awaitedParams?.location?.length < 2 || awaitedParams?.location?.length > 2)) {
      redirect(`/trouver-un-logement-etudiant`)
    }

    const territories = await getTerritories(routeLocation)
    const territory = (
      (territories[getTerritoriesCategoryKey(routeCategoryKey as 'ville' | 'academie' | 'departement')] || []) as TTerritory[]
    ).find((territory) => {
      const slug = 'slug' in territory ? territory.slug : territory.name
      return slug === routeLocation || territory.name === routeLocation
    })

    if (routeCategoryKey && routeLocation && !territory) {
      redirect(`/trouver-un-logement-etudiant`)
    }

    const territoryBbox = territory?.bbox
      ? expandBbox(territory.bbox.xmin, territory.bbox.ymin, territory.bbox.xmax, territory.bbox.ymax)
      : undefined

    const isAcademy = routeCategoryKey === 'academie'
    const serverBbox =
      !isAcademy && territoryBbox ? `${territoryBbox.west},${territoryBbox.south},${territoryBbox.east},${territoryBbox.north}` : undefined
    const serverAcademie = isAcademy && territory ? territory.id.toString() : undefined

    const queryClient = getQueryClient()
    const [, , session] = await Promise.all([
      prefetchAccommodations(awaitedSearchParams, { bbox: serverBbox, academie: serverAcademie }, queryClient),
      queryClient.prefetchQuery(trpc.favorites.list.queryOptions()),
      getServerSession(),
    ])

    return {
      dehydratedState: dehydrate(queryClient),
      user: session?.user,
      territory,
      isAcademy,
      serverBbox,
      serverAcademie,
      routeCategoryKey,
    }
  },
)
