'use client'

import { useQuery } from '@tanstack/react-query'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { useTRPC } from '~/server/trpc/client'

export const useAdminOwners = (params: { page: number; search?: string; contactMode?: EOwnerContactMode }) => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.owners.list.queryOptions(params))
}
