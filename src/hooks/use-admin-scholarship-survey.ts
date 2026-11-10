'use client'

import { useQuery } from '@tanstack/react-query'
import type { SurveyStatusFilter } from '~/server/scholarship-survey/admin'
import { useTRPC } from '~/server/trpc/client'

export const useAdminScholarshipSurveyStats = () => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.scholarshipSurvey.stats.queryOptions())
}

export const useAdminScholarshipSurveyList = (params: { status: SurveyStatusFilter; search?: string; page: number }) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.scholarshipSurvey.list.queryOptions(params))
}
