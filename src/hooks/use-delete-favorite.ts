import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'

export const useDeleteFavorite = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()

  const { mutateAsync, isPending } = useMutation(
    trpc.favorites.remove.mutationOptions({
      onSuccess: async () => {
        await queryClient.refetchQueries({
          queryKey: trpc.favorites.list.queryKey(),
          exact: false,
        })
        createToast({
          priority: 'success',
          message: 'Logement supprimé des favoris !',
        })
        router.refresh()
      },
      onError: (error) => {
        createToast({
          priority: 'error',
          message: error.message || 'Une erreur est survenue lors de la suppression des favoris.',
        })
      },
    }),
  )

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
