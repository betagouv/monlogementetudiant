'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useAdminDeleteUser = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  return useMutation({
    mutationFn: (id: string) => trpcClient.admin.users.delete.mutate({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.users.list.queryKey() })
      createToast({ priority: 'success', message: 'Utilisateur supprime' })
      router.push('/administration/utilisateurs')
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Erreur lors de la suppression' })
    },
  })
}
