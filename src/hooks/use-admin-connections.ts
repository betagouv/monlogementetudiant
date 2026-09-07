'use client'

import { useQuery } from '@tanstack/react-query'
import { ELoginOutcome } from '~/enums/login-attempt-status'
import { useTRPC } from '~/server/trpc/client'

type ConnectionsFilters = {
  page: number
  search?: string
  from?: string
  to?: string
  outcome?: ELoginOutcome
}

export const useAdminConnections = (filters: ConnectionsFilters) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.connections.list.queryOptions(filters))
}

export const useAdminStrandedAccounts = (filters: Omit<ConnectionsFilters, 'page' | 'outcome'>) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.connections.strandedAccounts.queryOptions(filters))
}
