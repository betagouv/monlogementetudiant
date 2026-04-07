import { useQuery } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'
import { parseAsString, useQueryState, useQueryStates } from 'nuqs'
import { accommodationsParsers } from '~/lib/accommodations-search-params'
import { useTRPC } from '~/server/trpc/client'

interface UseAccomodationsOptions {
  pageSize?: number
}

export const useAccomodations = ({ pageSize }: UseAccomodationsOptions = {}) => {
  const [queryStates] = useQueryStates(accommodationsParsers)
  const { bbox, academie, accessible, colocation, gestionnaire, page, prix, crous } = queryStates
  const [rechercheParCarte] = useQueryState('recherche-par-carte', parseAsString)
  const trpc = useTRPC()

  const pathname = usePathname()
  const pathSegments = pathname.split('/')
  const villeIndex = pathSegments.indexOf('ville')
  const citySlugFromPath = villeIndex !== -1 ? decodeURIComponent(pathSegments[villeIndex + 1] ?? '') || undefined : undefined

  const isMapSearch = rechercheParCarte === 'true'
  const effectiveCitySlug = citySlugFromPath && !isMapSearch ? citySlugFromPath : undefined

  const { data: territory } = useQuery({
    ...trpc.territories.getBySlug.queryOptions({
      type: 'ville' as const,
      slug: effectiveCitySlug!,
    }),
    enabled: !!effectiveCitySlug,
  })

  const cityId = effectiveCitySlug ? territory?.id : undefined

  return useQuery({
    ...trpc.accommodations.list.queryOptions({
      bbox: cityId ? undefined : (bbox ?? undefined),
      cityId,
      page: page ?? 1,
      pageSize: pageSize ?? 12,
      isAccessible: accessible === 'true' ? true : undefined,
      hasColiving: colocation === 'true' ? true : undefined,
      priceMax: prix ?? undefined,
      viewCrous: crous === 'true' ? true : false,
      academyId: academie ? Number(academie) : undefined,
      ownerSlug: gestionnaire ?? undefined,
    }),
    enabled: effectiveCitySlug ? !!cityId : true,
  })
}
