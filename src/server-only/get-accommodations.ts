import { dehydrate, QueryClient } from '@tanstack/react-query'
import { accommodationsQueryKey, accommodationsSearchParamsCache } from '~/lib/accommodations-search-params'
import type { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'

export const getAccommodations = async (searchParams: {
  accessible?: string
  academie?: string
  bbox?: string
  center?: string
  colocation?: string
  prix?: string
  page?: string
  page_size?: string
  crous?: string
}) => {
  const params = new URLSearchParams()
  if (searchParams.page) params.append('page', searchParams.page)
  if (searchParams.page_size) params.append('page_size', searchParams.page_size)
  if (searchParams.bbox) params.append('bbox', searchParams.bbox)
  if (searchParams.center) {
    params.append('center', searchParams.center)
    params.append('radius', '10')
  }
  if (searchParams.accessible) params.append('is_accessible', searchParams.accessible)
  if (searchParams.colocation) params.append('coliving', searchParams.colocation)
  if (searchParams.prix) params.append('price_max', searchParams.prix)
  if (searchParams.crous) params.append('view_crous', searchParams.crous)
  if (searchParams.academie) params.append('academy_id', searchParams.academie)

  const response = await fetch(`${process.env.API_URL}/accommodations/${params.size > 0 ? `?${params.toString()}` : ''}`)
  if (!response.ok) {
    return {
      count: 0,
      next: null,
      previous: null,
      min_price: null,
      max_price: null,
      page_size: 15,
      results: {
        features: [],
      },
    }
  }
  const data = await response.json()
  return data as TGetAccomodationsResponse
}

export const prefetchAccommodations = async (
  awaitedSearchParams: Record<string, string | string[] | undefined>,
  overrides?: { bbox?: string; academie?: string; pageSize?: number },
) => {
  const parsedParams = accommodationsSearchParamsCache.parse(awaitedSearchParams)
  const queryKeyParams = {
    ...parsedParams,
    bbox: overrides?.bbox ?? parsedParams.bbox,
    academie: overrides?.academie ?? parsedParams.academie,
    pageSize: overrides?.pageSize,
  }

  const searchParams: Record<string, string> = {}
  if (queryKeyParams.bbox) searchParams.bbox = queryKeyParams.bbox
  if (queryKeyParams.academie) searchParams.academie = queryKeyParams.academie
  if (parsedParams.accessible) searchParams.accessible = parsedParams.accessible
  if (parsedParams.colocation) searchParams.colocation = parsedParams.colocation
  if (parsedParams.prix) searchParams.prix = parsedParams.prix.toString()
  if (parsedParams.page) searchParams.page = parsedParams.page.toString()
  if (parsedParams.crous) searchParams.crous = parsedParams.crous
  if (overrides?.pageSize) searchParams.page_size = overrides.pageSize.toString()

  const queryClient = new QueryClient()
  await queryClient.prefetchQuery({
    queryKey: accommodationsQueryKey(queryKeyParams),
    queryFn: () => getAccommodations(searchParams),
  })

  const hasOverrides =
    (overrides?.bbox && overrides.bbox !== parsedParams.bbox) || (overrides?.academie && overrides.academie !== parsedParams.academie)

  if (hasOverrides) {
    const data = queryClient.getQueryData(accommodationsQueryKey(queryKeyParams))
    if (data) {
      queryClient.setQueryData(accommodationsQueryKey({ ...parsedParams, pageSize: overrides?.pageSize }), data)
    }
  }

  return dehydrate(queryClient)
}
