'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useAdminDeleteUser = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const t = useTranslations('toast')

  return useMutation({
    mutationFn: (id: string) => trpcClient.admin.users.delete.mutate({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.users.list.queryKey() })
      createToast({ priority: 'success', message: t('userDeleted') })
      router.push('/administration/utilisateurs')
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || t('userDeleteError') })
    },
  })
}
