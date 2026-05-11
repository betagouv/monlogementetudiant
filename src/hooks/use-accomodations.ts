import { useQuery } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { parseAsBoolean, useQueryState, useQueryStates } from 'nuqs'
import { accommodationsParsers } from '~/lib/accommodations-search-params'
import { useTRPC } from '~/server/trpc/client'

interface UseAccomodationsOptions {
  cityId?: number
  citySlug?: string
  pageSize?: number
}

export const useAccomodations = ({ cityId: cityIdOverride, citySlug, pageSize }: UseAccomodationsOptions = {}) => {
  const [queryStates] = useQueryStates(accommodationsParsers)
  const { bbox, academie, accessible, colocation, disponible, gestionnaire, page, prix, crous } = queryStates
  const [rechercheParCarte] = useQueryState('recherche-par-carte', parseAsBoolean)
  const trpc = useTRPC()

  const pathname = usePathname()
  const pathSegments = pathname.split('/')
  const villeIndex = pathSegments.indexOf('ville')
  const citySlugFromPath = villeIndex !== -1 ? decodeURIComponent(pathSegments[villeIndex + 1] ?? '') || undefined : undefined

  const isMapSearch = !!rechercheParCarte
  const effectiveCitySlug = citySlug ?? (citySlugFromPath && !isMapSearch ? citySlugFromPath : undefined)

  const { data: territory } = useQuery({
    ...trpc.territories.getBySlug.queryOptions({
      type: 'ville' as const,
      slug: effectiveCitySlug!,
    }),
    enabled: !!effectiveCitySlug && !cityIdOverride,
  })

  const cityId = cityIdOverride ?? (effectiveCitySlug ? territory?.id : undefined)

  return useQuery({
    ...trpc.accommodations.list.queryOptions({
      bbox: cityId ? undefined : (bbox ?? undefined),
      cityId,
      page: page ?? 1,
      pageSize: pageSize ?? 12,
      isAccessible: accessible || undefined,
      hasColiving: colocation || undefined,
      onlyWithAvailability: disponible || undefined,
      priceMax: prix ?? undefined,
      viewCrous: !!crous,
      academyId: academie ? Number(academie) : undefined,
      ownerSlug: gestionnaire ?? undefined,
    }),
    enabled: effectiveCitySlug ? !!cityId : true,
  })
}
