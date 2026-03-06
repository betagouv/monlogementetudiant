'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useAdminCreateUser = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const t = useTranslations('toast')

  return useMutation({
    mutationFn: (data: { email: string; firstname: string; lastname: string; role: 'admin' | 'owner' | 'user' }) =>
      trpcClient.admin.users.create.mutate(data),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.users.list.queryKey() })
      createToast({ priority: 'success', message: t('userCreated') })
      router.push(`/administration/utilisateurs/${created.id}`)
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || t('userCreateError') })
    },
  })
}
