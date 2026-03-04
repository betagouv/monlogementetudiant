'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { TUpdateResidence } from '~/schemas/accommodations/update-residence'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useUpdateResidenceDetails = (slug: string) => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

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
        message: 'Residence mise a jour avec succes',
      })
      router.refresh()
    },
    onError: () => {
      createToast({
        priority: 'error',
        message: 'Erreur lors de la mise a jour de la residence',
      })
    },
  })
}
