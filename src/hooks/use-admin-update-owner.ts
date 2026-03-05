'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useAdminUpdateOwner = () => {
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  return useMutation({
    mutationFn: (data: { id: number; name?: string; url?: string | null }) => trpcClient.admin.owners.update.mutate(data),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.owners.list.queryKey() })
      await queryClient.invalidateQueries({ queryKey: trpc.admin.owners.getById.queryKey({ id: updated.id }) })
      createToast({ priority: 'success', message: 'Bailleur mis a jour' })
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Erreur lors de la mise a jour' })
    },
  })
}
