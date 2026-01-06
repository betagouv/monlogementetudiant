import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { TDeleteAlert } from '~/schemas/alerts/delete-alert'

export const deleteAlert = async (id: number) =>
  fetch(`/api/alerts/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  })

export const useDeleteAlert = () => {
  const queryClient = useQueryClient()
  const router = useRouter()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (data: TDeleteAlert) => deleteAlert(data.id),
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: ['alerts'],
        exact: false,
      })
      createToast({
        priority: 'success',
        message: 'Alerte supprimée avec succès !',
      })
      router.refresh()
    },
    onError: (error: Error) => {
      createToast({
        priority: 'error',
        message: error.message || "Une erreur est survenue lors de la suppression de l'alerte.",
      })
    },
  })

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
