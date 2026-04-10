import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/server/trpc/client'

export function useOwnerUsage(range: { from: string; to: string }) {
  const trpc = useTRPC()

  const list = useQuery(trpc.admin.ownerUsage.list.queryOptions(range))
  const globalEvents = useQuery(trpc.admin.ownerUsage.globalEvents.queryOptions(range))

  return { list, globalEvents }
}

export function useOwnerUsageDetail(ownerId: number, range: { from: string; to: string }) {
  const trpc = useTRPC()

  return useQuery(trpc.admin.ownerUsage.detail.queryOptions({ ownerId, ...range }))
}
