'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useAdminUpdateUser = () => {
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const t = useTranslations('toast')

  return useMutation({
    mutationFn: (data: { id: string; email?: string; firstname?: string; lastname?: string; role?: 'admin' | 'owner' | 'user' }) =>
      trpcClient.admin.users.update.mutate(data),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.users.list.queryKey() })
      await queryClient.invalidateQueries({ queryKey: trpc.admin.users.getById.queryKey({ id: updated.id }) })
      createToast({ priority: 'success', message: t('userUpdated') })
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || t('userUpdateError') })
    },
  })
}
