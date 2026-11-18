'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { DEFAULT_BUDGET_SIMULATOR_STATE, useBudgetSimulator } from '~/components/budget-simulation/budget-simulator-context'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'

export function ResetBudgetButton() {
  const t = useTranslations('budgetSimulator.reset')
  const { setState } = useBudgetSimulator()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation(
    trpc.budgetSimulation.reset.mutationOptions({
      onSuccess: async () => {
        setState(DEFAULT_BUDGET_SIMULATOR_STATE)
        await queryClient.invalidateQueries({ queryKey: trpc.budgetSimulation.get.queryKey() })
        createToast({ priority: 'success', message: t('successToast') })
      },
      onError: () => createToast({ priority: 'error', message: t('errorToast') }),
    }),
  )

  return (
    <Button
      priority="secondary"
      iconId="ri-restart-line"
      iconPosition="left"
      disabled={isPending}
      onClick={() => mutate(DEFAULT_BUDGET_SIMULATOR_STATE)}
    >
      {t('button')}
    </Button>
  )
}
