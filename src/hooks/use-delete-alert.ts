import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'

export const useDeleteAlert = () => {
  const t = useTranslations('student.alerts.toast')
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()

  const { mutateAsync, isPending } = useMutation(
    trpc.alerts.delete.mutationOptions({
      onSuccess: async () => {
        await queryClient.refetchQueries({
          queryKey: trpc.alerts.list.queryKey(),
          exact: false,
        })
        createToast({
          priority: 'success',
          message: t('deleted'),
        })
        router.refresh()
      },
      onError: (error) => {
        createToast({
          priority: 'error',
          message: error.message || t('deleteError'),
        })
      },
    }),
  )

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
