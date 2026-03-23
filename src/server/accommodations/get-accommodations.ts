import { dehydrate } from '@tanstack/react-query'
import { accommodationsSearchParamsCache } from '~/lib/accommodations-search-params'
import { getQueryClient, trpc } from '~/server/trpc/server'

export const getAccommodations = (searchParams: {
  accessible?: string
  academie?: string
  bbox?: string
  gestionnaire?: string
  center?: string
  colocation?: string
  prix?: string
  page?: string
  page_size?: string
  crous?: string
}) =>
  getQueryClient().fetchQuery(
    trpc.accommodations.list.queryOptions({
      bbox: searchParams.bbox ?? undefined,
      center: searchParams.center ?? undefined,
      page: searchParams.page ? Number(searchParams.page) : 1,
      pageSize: searchParams.page_size ? Number(searchParams.page_size) : 12,
      isAccessible: searchParams.accessible === 'true' ? true : undefined,
      hasColiving: searchParams.colocation === 'true' ? true : undefined,
      priceMax: searchParams.prix ? Number(searchParams.prix) : undefined,
      viewCrous: searchParams.crous === 'true' ? true : false,
      academyId: searchParams.academie ? Number(searchParams.academie) : undefined,
      ownerSlug: searchParams.gestionnaire ?? undefined,
    }),
  )

export const prefetchAccommodations = async (
  awaitedSearchParams: Record<string, string | string[] | undefined>,
  overrides?: { bbox?: string; academie?: string; citySlug?: string; pageSize?: number },
) => {
  const parsedParams = accommodationsSearchParamsCache.parse(awaitedSearchParams)
  const queryKeyParams = {
    ...parsedParams,
    bbox: overrides?.bbox ?? parsedParams.bbox,
    academie: overrides?.academie ?? parsedParams.academie,
    gestionnaire: parsedParams.gestionnaire,
    pageSize: overrides?.pageSize,
  }

  const queryInput = {
    bbox: overrides?.citySlug ? undefined : (queryKeyParams.bbox ?? undefined),
    citySlug: overrides?.citySlug ?? undefined,
    page: queryKeyParams.page ?? 1,
    pageSize: queryKeyParams.pageSize ?? 12,
    isAccessible: queryKeyParams.accessible === 'true' ? true : undefined,
    hasColiving: queryKeyParams.colocation === 'true' ? true : undefined,
    priceMax: queryKeyParams.prix ?? undefined,
    viewCrous: queryKeyParams.crous === 'true' ? true : false,
    academyId: queryKeyParams.academie ? Number(queryKeyParams.academie) : undefined,
    ownerSlug: queryKeyParams.gestionnaire ?? undefined,
  }

  const client = getQueryClient()
  await client.prefetchQuery(trpc.accommodations.list.queryOptions(queryInput))

  const hasOverrides =
    (overrides?.bbox && overrides.bbox !== parsedParams.bbox) ||
    (overrides?.academie && overrides.academie !== parsedParams.academie) ||
    overrides?.citySlug

  if (hasOverrides) {
    const data = client.getQueryData(trpc.accommodations.list.queryOptions(queryInput).queryKey)
    if (data) {
      // Seed the cache key the client will use on first render (before SearchParamsSync updates the URL)
      const clientQueryInput = {
        ...queryInput,
        bbox: parsedParams.bbox ?? undefined,
        citySlug: parsedParams.ville ?? undefined,
        academyId: parsedParams.academie ? Number(parsedParams.academie) : undefined,
      }
      client.setQueryData(trpc.accommodations.list.queryOptions(clientQueryInput).queryKey, data)
    }
  }

  return dehydrate(client)
}
