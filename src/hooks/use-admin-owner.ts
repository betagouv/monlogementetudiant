'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/server/trpc/client'

export const useAdminOwner = (id: number) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.owners.getById.queryOptions({ id }))
}
