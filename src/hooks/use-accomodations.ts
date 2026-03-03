import { useQuery } from '@tanstack/react-query'
import { useQueryStates } from 'nuqs'
import { accommodationsParsers } from '~/lib/accommodations-search-params'
import { useTRPC } from '~/server/trpc/client'

interface UseAccomodationsOptions {
  pageSize?: number
}

export const useAccomodations = ({ pageSize }: UseAccomodationsOptions = {}) => {
  const [queryStates] = useQueryStates(accommodationsParsers)
  const { bbox, academie, accessible, colocation, page, prix, crous } = queryStates
  const trpc = useTRPC()

  return useQuery({
    ...trpc.accommodations.list.queryOptions({
      bbox: bbox ?? undefined,
      page: page ?? 1,
      pageSize: pageSize ?? 30,
      isAccessible: accessible === 'true' ? true : undefined,
      hasColiving: colocation === 'true' ? true : undefined,
      priceMax: prix ?? undefined,
      viewCrous: crous === 'true' ? true : false,
      academyId: academie ? Number(academie) : undefined,
    }),
  })
}
