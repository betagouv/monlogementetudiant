import { redirect } from 'next/navigation'
import { expandBbox } from '~/components/map/map-utils'
import { WidgetAccommodationFilters } from '~/components/widget/widget-accommodation-filters'
import { WidgetAccommodationGrid } from '~/components/widget/widget-accommodation-grid'
import { WidgetBodyStyle } from '~/components/widget/widget-body-style'
import { getAccommodations } from '~/server-only/get-accommodations'
import { getTerritories } from '~/server-only/get-territories'

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
    page?: string
    prix?: string
  }>
}) {
  const awaitedSearchParams = await searchParams

  // If city is provided but no bbox, resolve the city to bbox coordinates and redirect
  if (awaitedSearchParams.city && !awaitedSearchParams.bbox) {
    const territories = await getTerritories(awaitedSearchParams.city)
    const city = territories.cities?.find((c) => c.name === awaitedSearchParams.city || c.slug === awaitedSearchParams.city)

    if (city?.bbox) {
      const expanded = expandBbox(city.bbox.xmin, city.bbox.ymin, city.bbox.xmax, city.bbox.ymax)
      const bboxString = `${expanded.west},${expanded.south},${expanded.east},${expanded.north}`
      const params = new URLSearchParams()
      Object.entries(awaitedSearchParams).forEach(([key, value]) => {
        if (value !== undefined) params.set(key, value)
      })
      params.set('bbox', bboxString)
      redirect(`/widget/logements?${params.toString()}`)
    }
  }

  const hasLocation = !!awaitedSearchParams.city || !!awaitedSearchParams.bbox
  const showFilters = awaitedSearchParams.filters !== 'false'

  const accommodations = await getAccommodations({
    accessible: awaitedSearchParams.accessible,
    bbox: awaitedSearchParams.bbox,
    colocation: awaitedSearchParams.colocation,
    crous: awaitedSearchParams.crous,
    page: awaitedSearchParams.page,
    prix: awaitedSearchParams.prix,
  })

  return (
    <>
      <WidgetBodyStyle />
      {showFilters && <WidgetAccommodationFilters showLocationInput={!hasLocation} />}
      <WidgetAccommodationGrid data={accommodations} />
    </>
  )
}
