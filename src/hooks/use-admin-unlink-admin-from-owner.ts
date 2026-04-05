'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useAdminUnlinkAdminFromOwner = () => {
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  return useMutation({
    mutationFn: (data: { userId: string; ownerId: number }) => trpcClient.admin.users.unlinkAdminFromOwner.mutate(data),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.admin.users.myLinkedOwners.queryKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.admin.owners.getById.queryKey({ id: variables.ownerId }) }),
        queryClient.invalidateQueries({ queryKey: trpc.admin.users.getById.queryKey({ id: variables.userId }) }),
      ])
      createToast({ priority: 'success', message: 'Administrateur délié du gestionnaire' })
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Erreur lors de la déliaison' })
    },
  })
}
