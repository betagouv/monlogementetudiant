'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useAdminCreateOwner = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  return useMutation({
    mutationFn: (data: { name: string; url?: string }) => trpcClient.admin.owners.create.mutate(data),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.owners.list.queryKey() })
      createToast({ priority: 'success', message: 'Bailleur cree avec succes' })
      router.push(`/administration/bailleurs/${created.id}`)
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Erreur lors de la creation' })
    },
  })
}
