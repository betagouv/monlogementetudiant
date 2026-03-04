import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'

export const useDeleteAlert = () => {
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
          message: 'Alerte supprimée avec succès !',
        })
        router.refresh()
      },
      onError: (error) => {
        createToast({
          priority: 'error',
          message: error.message || "Une erreur est survenue lors de la suppression de l'alerte.",
        })
      },
    }),
  )

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
