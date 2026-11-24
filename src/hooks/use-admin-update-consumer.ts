'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

type UpdateConsumerInput = {
  keyId: string
  name?: string
  enabled?: boolean
  contact?: string
  description?: string
  rateLimitEnabled?: boolean
  rateLimitMax?: number
  rateLimitWindowSeconds?: number
  ownerId?: number | null
}

export const useAdminUpdateConsumer = () => {
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  return useMutation({
    mutationFn: (data: UpdateConsumerInput) => trpcClient.admin.consumers.update.mutate(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.consumers.list.queryKey() })
      createToast({ priority: 'success', message: 'Consommateur mis à jour' })
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Erreur lors de la mise à jour du consommateur' })
    },
  })
}
