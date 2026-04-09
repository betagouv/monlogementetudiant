import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/server/trpc/client'

export function useMatomoStats(range: { from: string; to: string }, eventCategory?: string) {
  const trpc = useTRPC()

  const overview = useQuery(trpc.admin.matomoStats.overview.queryOptions(range))
  const visitorsOverTime = useQuery(trpc.admin.matomoStats.visitorsOverTime.queryOptions(range))
  const trends = useQuery(trpc.admin.matomoStats.trendsOverTime.queryOptions(range))
  const topPages = useQuery(trpc.admin.matomoStats.topPages.queryOptions(range))
  const topEntryPages = useQuery(trpc.admin.matomoStats.topEntryPages.queryOptions(range))
  const topSources = useQuery(trpc.admin.matomoStats.topSources.queryOptions(range))
  const eventsByCategory = useQuery(trpc.admin.matomoStats.eventsByCategory.queryOptions(range))
  const topEventActions = useQuery(trpc.admin.matomoStats.topEventActions.queryOptions({ ...range, category: eventCategory }))

  return { overview, visitorsOverTime, trends, topPages, topEntryPages, topSources, eventsByCategory, topEventActions }
}
