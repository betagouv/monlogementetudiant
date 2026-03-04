'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { TUpdateResidenceList } from '~/schemas/accommodations/update-residence-list'
import { useTRPC, useTRPCClient } from '~/server/trpc/client'

export const useUpdateAccommodation = (slug: string) => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()
  const trpcClient = useTRPCClient()

  return useMutation({
    mutationFn: async (data: TUpdateResidenceList) => {
      return trpcClient.bailleur.updateAvailability.mutate({ slug, ...data })
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
