'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/server/trpc/client'

export const useAdminUser = (id: string) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.users.getById.queryOptions({ id }))
}
