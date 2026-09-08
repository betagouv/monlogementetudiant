import { dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { computeExpandedPriceMax, EXPANDED_SEARCH_PAGE_SIZE, EXPANDED_SEARCH_RADIUS_KM } from '~/lib/accommodations-expanded-search'
import { accommodationsSearchParamsCache } from '~/lib/accommodations-search-params'
import { TTerritory } from '~/schemas/territories'
import { prefetchAccommodations } from '~/server/accommodations/get-accommodations'
import { getQueryClient, trpc } from '~/server/trpc/server'
import { getServerSession } from '~/services/better-auth'

const VALID_CATEGORIES = ['ville', 'academie', 'departement'] as const
type Category = (typeof VALID_CATEGORIES)[number]

const getSingleSearchParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export const getStudentAccommodationPageContext = cache(
  async (awaitedParams: { location: string[] }, awaitedSearchParams: Record<string, string | string[] | undefined>) => {
    const routeCategoryKey = awaitedParams?.location?.[0] || ''
    const routeLocation = decodeURIComponent(awaitedParams?.location?.[1] || '')
    if (awaitedParams?.location) {
      if (awaitedParams.location.length !== 2) {
        redirect(`/trouver-un-logement-etudiant`)
      }

      if (!VALID_CATEGORIES.includes(routeCategoryKey as Category)) {
        redirect(`/trouver-un-logement-etudiant`)
      }
    }

    let territory: TTerritory | undefined

    if (routeCategoryKey && routeLocation) {
      try {
        territory = await getQueryClient().fetchQuery(
          trpc.territories.getBySlug.queryOptions({
            type: routeCategoryKey as Category,
            slug: routeLocation,
          }),
        )
      } catch {
        redirect(`/trouver-un-logement-etudiant`)
      }
    }

    const isAcademy = routeCategoryKey === 'academie'
    const isCity = routeCategoryKey === 'ville'
    const isDepartment = routeCategoryKey === 'departement'
    const isMapSearch = getSingleSearchParam(awaitedSearchParams['recherche-par-carte']) === 'true'
    const serverAcademie = isAcademy && territory ? territory.id.toString() : undefined
    const serverCityId = isCity && territory && !isMapSearch ? territory.id : undefined
    // Département : on filtre sur la frontière (ST_Within côté serveur) et non sur la bbox, qui
    // faisait remonter les résidences des départements voisins tombant dans le rectangle englobant.
    const serverDepartmentId = isDepartment && territory && !isMapSearch ? territory.id : undefined

    const queryClient = getQueryClient()

    const session = await getServerSession()

    if (session?.user.role === 'user') {
      await queryClient.prefetchQuery(trpc.favorites.list.queryOptions())
    }

    // Fetch main results first so we can extract IDs for the expanded search exclusion
    await prefetchAccommodations(awaitedSearchParams, {
      academie: serverAcademie,
      cityId: serverCityId,
      departmentId: serverDepartmentId,
    })

    const cityName = routeCategoryKey === 'ville' ? territory?.name : undefined
    if (cityName) {
      const rawPrice = Number(getSingleSearchParam(awaitedSearchParams.prix))
      const expandedPriceMax = computeExpandedPriceMax(Number.isFinite(rawPrice) ? rawPrice : undefined)

      const parsedParams = accommodationsSearchParamsCache.parse(awaitedSearchParams)
      const serverQueryInput = {
        bbox: serverCityId ? undefined : (parsedParams.bbox ?? undefined),
        cityId: serverCityId ?? undefined,
        page: parsedParams.page ?? 1,
        pageSize: 12,
        isAccessible: parsedParams.accessible || undefined,
        hasColiving: parsedParams.colocation || undefined,
        priceMax: parsedParams.prix ?? undefined,
        viewCrous: !!parsedParams.crous,
        academyId: (serverAcademie ?? parsedParams.academie) ? Number(serverAcademie ?? parsedParams.academie) : undefined,
        ownerSlug: parsedParams.gestionnaire ?? undefined,
      }
      const mainData = queryClient.getQueryData(trpc.accommodations.list.queryOptions(serverQueryInput).queryKey)
      const excludeIds = (mainData as { results: { id: number }[] } | undefined)?.results.map((a) => a.id) ?? []

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

    return {
      dehydratedState: dehydrate(queryClient),
      user: session?.user,
      territory,
      isAcademy,
      serverAcademie,
      routeCategoryKey,
    }
  },
)
