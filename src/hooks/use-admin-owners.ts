'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/server/trpc/client'

export const useAdminOwners = (params: { page: number; search?: string }) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.owners.list.queryOptions(params))
}
