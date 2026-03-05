'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useAdminCreateUser = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  return useMutation({
    mutationFn: (data: { email: string; firstname: string; lastname: string; role: 'admin' | 'owner' | 'user' }) =>
      trpcClient.admin.users.create.mutate(data),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.users.list.queryKey() })
      createToast({ priority: 'success', message: 'Utilisateur cree avec succes' })
      router.push(`/administration/utilisateurs/${created.id}`)
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Erreur lors de la creation' })
    },
  })
}
