'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/server/trpc/client'

export const useAdminRecettes = () => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.recettes.list.queryOptions())
}
