import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'

export const useCreateFavorite = () => {
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
          message: 'Logement ajouté aux favoris !',
        })
        router.refresh()
      },
      onError: (error) => {
        createToast({
          priority: 'error',
          message: error.message || "Une erreur est survenue lors de l'ajout aux favoris.",
        })
      },
    }),
  )

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
