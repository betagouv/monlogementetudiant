import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'

export const useCreateFavorite = () => {
  const t = useTranslations('student.favorites.toast')
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()

  const { mutateAsync, isPending } = useMutation(
    trpc.favorites.add.mutationOptions({
      onSuccess: async () => {
        await queryClient.refetchQueries({
          queryKey: trpc.favorites.list.queryKey(),
          exact: false,
        })
        createToast({
          priority: 'success',
          message: t('added'),
        })
        router.refresh()
      },
      onError: (error) => {
        createToast({
          priority: 'error',
          message: error.message || t('addError'),
        })
      },
    }),
  )

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
