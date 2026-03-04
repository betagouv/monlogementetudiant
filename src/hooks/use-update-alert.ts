import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'

export const useUpdateAlert = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()

  const { mutateAsync, isPending } = useMutation(
    trpc.alerts.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.refetchQueries({
          queryKey: trpc.alerts.list.queryKey(),
          exact: false,
        })
        createToast({
          priority: 'success',
          message: 'Alerte mise à jour avec succès !',
        })
        router.refresh()
      },
      onError: (error) => {
        createToast({
          priority: 'error',
          message: error.message || "Une erreur est survenue lors de la mise à jour de l'alerte.",
        })
      },
    }),
  )

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
