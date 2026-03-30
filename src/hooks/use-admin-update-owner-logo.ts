'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { type TOwnerLogoInput } from '~/schemas/owner-logo-form'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useAdminUpdateOwnerLogo = () => {
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const t = useTranslations('toast')

  return useMutation({
    mutationFn: (data: TOwnerLogoInput) => trpcClient.admin.owners.updateLogo.mutate(data),
    onSuccess: async (_updated, variables) => {
      await queryClient.invalidateQueries({ queryKey: trpc.admin.owners.list.queryKey() })
      await queryClient.invalidateQueries({ queryKey: trpc.admin.owners.getById.queryKey({ id: variables.id }) })
      createToast({ priority: 'success', message: t('ownerUpdated') })
    },
    onError: (error) => {
      createToast({ priority: 'error', message: error.message || t('ownerUpdateError') })
    },
  })
}
