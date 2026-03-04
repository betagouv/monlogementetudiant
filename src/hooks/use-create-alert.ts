import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { useTRPC } from '~/server/trpc/client'

export const useCreateAlert = () => {
  const queryClient = useQueryClient()
  const router = useRouter()
  const trpc = useTRPC()

  const { mutateAsync, isPending } = useMutation(
    trpc.alerts.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.refetchQueries({
          queryKey: trpc.alerts.list.queryKey(),
          exact: false,
        })
        createToast({
          priority: 'success',
          message: 'Alerte créée avec succès !',
        })
        router.refresh()
      },
      onError: (error) => {
        createToast({
          priority: 'error',
          message: error.message || "Une erreur est survenue lors de la création de l'alerte.",
        })
      },
    }),
  )

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
