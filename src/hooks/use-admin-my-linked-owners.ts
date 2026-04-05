'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/server/trpc/client'

export const useAdminMyLinkedOwners = () => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.users.myLinkedOwners.queryOptions())
}
