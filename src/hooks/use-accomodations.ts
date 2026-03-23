import { useQuery } from '@tanstack/react-query'
import { parseAsString, useQueryState, useQueryStates } from 'nuqs'
import { accommodationsParsers } from '~/lib/accommodations-search-params'
import { useTRPC } from '~/server/trpc/client'

interface UseAccomodationsOptions {
  pageSize?: number
}

export const useAccomodations = ({ pageSize }: UseAccomodationsOptions = {}) => {
  const [queryStates] = useQueryStates(accommodationsParsers)
  const { bbox, academie, accessible, colocation, gestionnaire, page, prix, crous, ville } = queryStates
  const [rechercheParCarte] = useQueryState('recherche-par-carte', parseAsString)
  const trpc = useTRPC()

  const isMapSearch = rechercheParCarte === 'true'
  const effectiveCitySlug = ville && !isMapSearch ? ville : undefined

  return useQuery({
    ...trpc.accommodations.list.queryOptions({
      bbox: effectiveCitySlug ? undefined : (bbox ?? undefined),
      citySlug: effectiveCitySlug,
      page: page ?? 1,
      pageSize: pageSize ?? 12,
      isAccessible: accessible === 'true' ? true : undefined,
      hasColiving: colocation === 'true' ? true : undefined,
      priceMax: prix ?? undefined,
      viewCrous: crous === 'true' ? true : false,
      academyId: academie ? Number(academie) : undefined,
      ownerSlug: gestionnaire ?? undefined,
    }),
  })
}
