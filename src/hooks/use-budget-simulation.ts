import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'

interface UseSaveBudgetSimulationOptions {
  silent?: boolean
}

export const useSaveBudgetSimulation = (options?: UseSaveBudgetSimulationOptions) => {
  const t = useTranslations('budgetSimulator.summary')
  const queryClient = useQueryClient()
  const trpc = useTRPC()

  const { mutateAsync, isPending } = useMutation(
    trpc.budgetSimulation.save.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.budgetSimulation.get.queryKey(),
        })
        if (!options?.silent) {
          createToast({
            priority: 'success',
            message: t('saveSuccessToast'),
          })
        }
      },
      onError: (error) => {
        createToast({
          priority: 'error',
          message: error.message || t('saveErrorToast'),
        })
      },
    }),
  )

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
