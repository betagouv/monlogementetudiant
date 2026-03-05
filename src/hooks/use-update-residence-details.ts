'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useUpdateResidenceDetails = (slug: string) => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()
  const t = useTranslations('toast')

  return useMutation({
    mutationFn: async (data: TUpdateResidence) => {
      return trpcClient.bailleur.update.mutate({ slug, ...data })
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: trpc.bailleur.list.queryKey(),
        exact: false,
      })
      createToast({
        priority: 'success',
        message: t('residenceUpdated'),
      })
      router.refresh()
    },
    onError: () => {
      createToast({
        priority: 'error',
        message: t('residenceUpdateError'),
      })
    },
  })
}
