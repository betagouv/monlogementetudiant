'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '~/server/trpc/client'

export const useAdminChangelog = () => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.changelog.list.queryOptions())
}
