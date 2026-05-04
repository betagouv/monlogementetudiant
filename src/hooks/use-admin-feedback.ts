'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/server/trpc/client'

type DateRange = { from?: string; to?: string }

export const useAdminFeedbackStats = (range: DateRange) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.feedback.stats.queryOptions(range))
}

export const useAdminFeedbackList = (params: { page: number; from?: string; to?: string; rating?: number }) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.feedback.list.queryOptions(params))
}
