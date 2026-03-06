'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useAdminDeleteOwner = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const t = useTranslations('toast')

  return useMutation({
    mutationFn: (id: number) => trpcClient.admin.owners.delete.mutate({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.owners.list.queryKey() })
      createToast({ priority: 'success', message: t('ownerDeleted') })
      router.push('/administration/bailleurs')
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || t('ownerDeleteError') })
    },
  })
}
