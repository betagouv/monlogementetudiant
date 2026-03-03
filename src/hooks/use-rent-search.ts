import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/server/trpc/client'

export function useRentSearch(query: string) {
  const trpc = useTRPC()

  return useQuery({
    ...trpc.territories.rentSearch.queryOptions({ q: query }),
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
