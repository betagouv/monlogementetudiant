import { dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { expandBbox } from '~/components/map/map-utils'
import { computeExpandedPriceMax, EXPANDED_SEARCH_PAGE_SIZE, EXPANDED_SEARCH_RADIUS_KM } from '~/lib/accommodations-expanded-search'
import { TTerritories, TTerritory } from '~/schemas/territories'
import { prefetchAccommodations } from '~/server/accommodations/get-accommodations'
import { getTerritories } from '~/server/territories/get-territories'
import { getQueryClient, trpc } from '~/server/trpc/server'
import { getServerSession } from '~/services/better-auth'

const getTerritoriesCategoryKey = (categoryKey: 'ville' | 'academie' | 'departement') => {
  const keys = {
    academie: 'academies',
    departement: 'departments',
    ville: 'cities',
  }
  return keys[categoryKey] as keyof TTerritories
}

const getSingleSearchParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export const getStudentAccommodationPageContext = cache(
  async (awaitedParams: { location: string }, awaitedSearchParams: Record<string, string | string[] | undefined>) => {
    const routeCategoryKey = awaitedParams?.location?.[0] || ''
    const routeLocation = decodeURIComponent(awaitedParams?.location?.[1] || '')

    if (awaitedParams?.location) {
      if (awaitedParams.location.length !== 2) {
        redirect(`/trouver-un-logement-etudiant`)
      }

      if (!['ville', 'academie', 'departement'].includes(routeCategoryKey)) {
        redirect(`/trouver-un-logement-etudiant`)
      }
    }

    const territories = await getTerritories(routeLocation)
    const territoryList: TTerritory[] =
      territories[getTerritoriesCategoryKey(routeCategoryKey as 'ville' | 'academie' | 'departement')] || []
    const territory = territoryList.find((territory) => {
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
    const prefetchPromises: Promise<unknown>[] = [
      prefetchAccommodations(awaitedSearchParams, { bbox: serverBbox, academie: serverAcademie }),
      queryClient.prefetchQuery(trpc.favorites.list.queryOptions()),
    ]

    const cityName = routeCategoryKey === 'ville' ? territory?.name : undefined
    if (cityName) {
      const rawPrice = Number(getSingleSearchParam(awaitedSearchParams.prix))
      const expandedPriceMax = computeExpandedPriceMax(Number.isFinite(rawPrice) ? rawPrice : undefined)

      prefetchPromises.push(
        queryClient.prefetchQuery(
          trpc.accommodations.listExpandedByCity.queryOptions({
            city: cityName,
            radius: EXPANDED_SEARCH_RADIUS_KM,
            page: 1,
            pageSize: EXPANDED_SEARCH_PAGE_SIZE,
            isAccessible: getSingleSearchParam(awaitedSearchParams.accessible) === 'true' ? true : undefined,
            hasColiving: getSingleSearchParam(awaitedSearchParams.colocation) === 'true' ? true : undefined,
            viewCrous: getSingleSearchParam(awaitedSearchParams.crous) === 'true',
            ownerSlug: getSingleSearchParam(awaitedSearchParams.gestionnaire),
            priceMax: expandedPriceMax,
          }),
        ),
      )
    }

    const sessionPromise = getServerSession()
    await Promise.all([...prefetchPromises, sessionPromise])
    const session = await sessionPromise

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
