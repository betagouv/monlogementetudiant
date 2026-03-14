import { HydrationBoundary } from '@tanstack/react-query'
import { expandBbox } from '~/components/map/map-utils'
import { SearchParamsSync } from '~/components/search-params-sync'
import { WidgetAccommodationFilters } from '~/components/widget/widget-accommodation-filters'
import { WidgetAccommodationGrid } from '~/components/widget/widget-accommodation-grid'
import { WidgetBodyStyle } from '~/components/widget/widget-body-style'
import { prefetchAccommodations } from '~/server/accommodations/get-accommodations'
import { getTerritories } from '~/server/territories/get-territories'

export const dynamic = 'force-dynamic'

export default async function WidgetLogementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    accessible?: string
    bbox?: string
    city?: string
    colocation?: string
    crous?: string
    filters?: string
    gestionnaire?: string
    page?: string
    prix?: string
  }>
}) {
  const awaitedSearchParams = await searchParams

  const hasLocation = !!awaitedSearchParams.city || !!awaitedSearchParams.bbox
  const showFilters = awaitedSearchParams.filters !== 'false'

  // Resolve city → bbox + name without redirecting
  let cityName: string | undefined
  let serverBbox: string | undefined

  if (awaitedSearchParams.city) {
    const territories = await getTerritories(awaitedSearchParams.city)
    const city = territories.cities?.find((c) => c.name === awaitedSearchParams.city || c.slug === awaitedSearchParams.city)
    cityName = city?.name ?? awaitedSearchParams.city

    if (city?.bbox && !awaitedSearchParams.bbox) {
      const expanded = expandBbox(city.bbox.xmin, city.bbox.ymin, city.bbox.xmax, city.bbox.ymax)
      serverBbox = `${expanded.west},${expanded.south},${expanded.east},${expanded.north}`
    }
  }

  const dehydratedState = await prefetchAccommodations(awaitedSearchParams, { bbox: serverBbox, pageSize: 6 })

  return (
    <HydrationBoundary state={dehydratedState}>
      <SearchParamsSync bbox={serverBbox} />
      <WidgetBodyStyle />
      {showFilters && <WidgetAccommodationFilters showLocationInput={!hasLocation} />}
      <WidgetAccommodationGrid cityName={cityName} />
    </HydrationBoundary>
  )
}
