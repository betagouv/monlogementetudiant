'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useAdminEmailSettings = () => {
  const trpc = useTRPC()
  return useQuery(trpc.admin.emailSettings.get.queryOptions())
}

export const useUpdateAdminEmailSettings = () => {
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  return useMutation({
    mutationFn: (input: { redirectEmail: string | null; bypassRedirect: boolean }) => trpcClient.admin.emailSettings.update.mutate(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.emailSettings.get.queryKey() })
      createToast({ priority: 'success', message: 'Réglages d’interception mis à jour' })
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Échec de la mise à jour des réglages' })
    },
  })
}
