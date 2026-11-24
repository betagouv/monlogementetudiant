'use client'

import { useQuery } from '@tanstack/react-query'
import type { TMonthRange } from '~/schemas/admin-metrics/month-range'
import { useTRPC } from '~/server/trpc/client'

export const useAdminMetricsCandidatures = (range: TMonthRange) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.metrics.candidatures.queryOptions({ range }))
}

export const useAdminMetricsStudents = (range: TMonthRange) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.metrics.students.queryOptions({ range }))
}

export const useAdminMetricsContactPath = (range: TMonthRange) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.metrics.contactPath.queryOptions({ range }))
}

export const useAdminOwnersToTarget = () => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.metrics.ownersToTarget.queryOptions())
}

export const useAdminModeration = (month: string) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.metrics.moderation.queryOptions({ month }))
}

export const useAdminCityMetrics = (month: string) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.metrics.cities.queryOptions({ month }))
}
