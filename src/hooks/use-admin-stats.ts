'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/server/trpc/client'

export const useAdminStats = () => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.stats.overview.queryOptions())
}
