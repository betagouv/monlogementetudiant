import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { WidgetAccommodationFilters } from '~/components/widget/widget-accommodation-filters'
import { WidgetAccommodationGrid } from '~/components/widget/widget-accommodation-grid'
import { WidgetBodyStyle } from '~/components/widget/widget-body-style'
import { parseVisibleFilters } from '~/components/widget/widget-filters'
import { computeExpandedPriceMax, EXPANDED_SEARCH_PAGE_SIZE, EXPANDED_SEARCH_RADIUS_KM } from '~/lib/accommodations-expanded-search'
import { accommodationsSearchParamsCache } from '~/lib/accommodations-search-params'
import { TCity } from '~/schemas/territories'
import { prefetchAccommodations } from '~/server/accommodations/get-accommodations'
import { getTerritories } from '~/server/territories/get-territories'
import { getQueryClient, trpc } from '~/server/trpc/server'

export const dynamic = 'force-dynamic'

const WIDGET_PAGE_SIZE = 6

export default async function WidgetLogementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    accessible?: string
    city?: string
    colocation?: string
    crous?: string
    disponible?: string
    filters?: string
    gestionnaire?: string
    page?: string
    prix?: string
  }>
}) {
  const awaitedSearchParams = await searchParams

  const hasLocation = !!awaitedSearchParams.city
  const visibleFilters = parseVisibleFilters(awaitedSearchParams.filters)

  let city: TCity | undefined

  if (awaitedSearchParams.city) {
    const territories = await getTerritories(awaitedSearchParams.city)
    city = territories.cities?.find((c) => c.name === awaitedSearchParams.city || c.slug === awaitedSearchParams.city)
  }

  await prefetchAccommodations(awaitedSearchParams, { cityId: city?.id, pageSize: WIDGET_PAGE_SIZE })

  const queryClient = getQueryClient()

  if (city) {
    const parsedParams = accommodationsSearchParamsCache.parse(awaitedSearchParams)
    const expandedPriceMax = computeExpandedPriceMax(parsedParams.prix ?? undefined)

    const mainQueryInput = {
      cityId: city.id,
      page: parsedParams.page ?? 1,
      pageSize: WIDGET_PAGE_SIZE,
      isAccessible: parsedParams.accessible || undefined,
      hasColiving: parsedParams.colocation || undefined,
      onlyWithAvailability: parsedParams.disponible || undefined,
      priceMax: parsedParams.prix ?? undefined,
      viewCrous: !!parsedParams.crous,
      academyId: parsedParams.academie ? Number(parsedParams.academie) : undefined,
      ownerSlug: parsedParams.gestionnaire ?? undefined,
    }
    const mainData = queryClient.getQueryData(trpc.accommodations.list.queryOptions(mainQueryInput).queryKey)
    const excludeIds = mainData?.results.features.map((f) => f.id) ?? []

    await queryClient.prefetchQuery(
      trpc.accommodations.listExpandedByCity.queryOptions({
        city: city.name,
        radius: EXPANDED_SEARCH_RADIUS_KM,
        page: 1,
        pageSize: EXPANDED_SEARCH_PAGE_SIZE,
        isAccessible: parsedParams.accessible || undefined,
        hasColiving: parsedParams.colocation || undefined,
        onlyWithAvailability: parsedParams.disponible || undefined,
        viewCrous: !!parsedParams.crous,
        ownerSlug: parsedParams.gestionnaire ?? undefined,
        priceMax: expandedPriceMax,
        excludeIds,
      }),
    )
  }

  const dehydratedState = dehydrate(queryClient)

  return (
    <HydrationBoundary state={dehydratedState}>
      <WidgetBodyStyle />
      {visibleFilters && <WidgetAccommodationFilters showLocationInput={!hasLocation} visibleFilters={visibleFilters} />}
      <WidgetAccommodationGrid territory={city} />
    </HydrationBoundary>
  )
}
