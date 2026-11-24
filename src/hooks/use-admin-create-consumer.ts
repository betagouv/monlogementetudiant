'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

type CreateConsumerInput = {
  name: string
  contact?: string
  description?: string
  rateLimitMax?: number
  rateLimitWindowSeconds?: number
  ownerId?: number
}

export const useAdminCreateConsumer = () => {
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  return useMutation({
    mutationFn: (data: CreateConsumerInput) => trpcClient.admin.consumers.create.mutate(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.consumers.list.queryKey() })
      createToast({ priority: 'success', message: 'Consommateur créé' })
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || 'Erreur lors de la création du consommateur' })
    },
  })
}
