import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/server/trpc/client'

export type OwnerStatsPeriod = '7d' | '30d' | '90d'

interface UseOwnerStatisticsOptions {
  period: OwnerStatsPeriod
  ownerId?: number
  residencePage: number
  residenceSearch: string
  cityPage: number
  citySearch: string
}

export function useOwnerStatistics({ period, ownerId, residencePage, residenceSearch, cityPage, citySearch }: UseOwnerStatisticsOptions) {
  const trpc = useTRPC()

  const overview = useQuery(trpc.ownerStatistics.overview.queryOptions({ period, ownerId }))
  const byAccommodation = useQuery(
    trpc.ownerStatistics.byAccommodation.queryOptions({
      period,
      ownerId,
      page: residencePage,
      search: residenceSearch,
    }),
  )
  const byCity = useQuery(
    trpc.ownerStatistics.byCity.queryOptions({
      period,
      ownerId,
      page: cityPage,
      search: citySearch,
    }),
  )

  return { overview, byAccommodation, byCity }
}
