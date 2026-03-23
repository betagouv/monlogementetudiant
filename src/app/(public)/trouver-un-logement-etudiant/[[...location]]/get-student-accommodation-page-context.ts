import { dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { expandBbox } from '~/components/map/map-utils'
import { computeExpandedPriceMax, EXPANDED_SEARCH_PAGE_SIZE, EXPANDED_SEARCH_RADIUS_KM } from '~/lib/accommodations-expanded-search'
import { accommodationsSearchParamsCache } from '~/lib/accommodations-search-params'
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
  async (awaitedParams: { location: string[] }, awaitedSearchParams: Record<string, string | string[] | undefined>) => {
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
    const isCity = routeCategoryKey === 'ville'
    const serverBbox =
      !isAcademy && !isCity && territoryBbox
        ? `${territoryBbox.west},${territoryBbox.south},${territoryBbox.east},${territoryBbox.north}`
        : undefined
    const serverAcademie = isAcademy && territory ? territory.id.toString() : undefined
    const serverVille = isCity && territory && 'slug' in territory ? territory.slug : undefined

    const queryClient = getQueryClient()

    const sessionPromise = getServerSession()
    const favoritesPromise = queryClient.prefetchQuery(trpc.favorites.list.queryOptions())

    // Fetch main results first so we can extract IDs for the expanded search exclusion
    await prefetchAccommodations(awaitedSearchParams, { bbox: serverBbox, academie: serverAcademie, citySlug: serverVille })

    const cityName = routeCategoryKey === 'ville' ? territory?.name : undefined
    if (cityName) {
      const rawPrice = Number(getSingleSearchParam(awaitedSearchParams.prix))
      const expandedPriceMax = computeExpandedPriceMax(Number.isFinite(rawPrice) ? rawPrice : undefined)

      const parsedParams = accommodationsSearchParamsCache.parse(awaitedSearchParams)
      const serverQueryInput = {
        bbox: serverVille ? undefined : (serverBbox ?? parsedParams.bbox ?? undefined),
        citySlug: serverVille ?? undefined,
        page: parsedParams.page ?? 1,
        pageSize: 12,
        isAccessible: parsedParams.accessible === 'true' ? true : undefined,
        hasColiving: parsedParams.colocation === 'true' ? true : undefined,
        priceMax: parsedParams.prix ?? undefined,
        viewCrous: parsedParams.crous === 'true' ? true : false,
        academyId: (serverAcademie ?? parsedParams.academie) ? Number(serverAcademie ?? parsedParams.academie) : undefined,
        ownerSlug: parsedParams.gestionnaire ?? undefined,
      }
      const mainData = queryClient.getQueryData(trpc.accommodations.list.queryOptions(serverQueryInput).queryKey)
      const excludeIds = (mainData as { results: { features: { id: number }[] } } | undefined)?.results.features.map((f) => f.id) ?? []

      await queryClient.prefetchQuery(
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
          excludeIds,
        }),
      )
    }

    const [_, session] = await Promise.all([favoritesPromise, sessionPromise])

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
