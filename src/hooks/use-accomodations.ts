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
  const { bbox, academie, accessible, city, colocation, disponible, gestionnaire, page, prix, crous } = queryStates
  const [rechercheParCarte] = useQueryState('recherche-par-carte', parseAsBoolean)
  const trpc = useTRPC()

  const pathname = usePathname()
  const pathSegments = pathname.split('/')
  const slugFromPath = (segment: string) => {
    const index = pathSegments.indexOf(segment)
    return index !== -1 ? decodeURIComponent(pathSegments[index + 1] ?? '') || undefined : undefined
  }
  const citySlugFromPath = slugFromPath('ville')
  const departmentSlugFromPath = slugFromPath('departement')

  const isMapSearch = !!rechercheParCarte
  const effectiveCitySlug = citySlug ?? city ?? (citySlugFromPath && !isMapSearch ? citySlugFromPath : undefined)
  // Sur une page département, on filtre par l'id du département (frontière réelle) plutôt que par la
  // bbox, qui remontait les résidences des départements limitrophes.
  const effectiveDepartmentSlug =
    !effectiveCitySlug && !cityIdOverride && departmentSlugFromPath && !isMapSearch ? departmentSlugFromPath : undefined

  const { data: territory } = useQuery({
    ...trpc.territories.getBySlug.queryOptions({
      type: 'ville' as const,
      slug: effectiveCitySlug!,
    }),
    enabled: !!effectiveCitySlug && !cityIdOverride,
  })

  const { data: departmentTerritory } = useQuery({
    ...trpc.territories.getBySlug.queryOptions({
      type: 'departement' as const,
      slug: effectiveDepartmentSlug!,
    }),
    enabled: !!effectiveDepartmentSlug,
  })

  const cityId = cityIdOverride ?? (effectiveCitySlug ? territory?.id : undefined)
  const departmentId = effectiveDepartmentSlug ? departmentTerritory?.id : undefined

  return useQuery({
    ...trpc.accommodations.list.queryOptions({
      bbox: cityId || departmentId ? undefined : (bbox ?? undefined),
      cityId,
      departmentId,
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
    enabled: effectiveCitySlug ? !!cityId : effectiveDepartmentSlug ? !!departmentId : true,
  })
}
