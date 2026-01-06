import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { TUpdateAlertRequest } from '~/schemas/alerts/update-alert'

export const putAlert = async (body: TUpdateAlertRequest): Promise<void> => {
  const response = await fetch(`/api/alerts/${body.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error('Failed to update alert')
  }

  return response.json()
}

export const useUpdateAlert = () => {
  const queryClient = useQueryClient()
  const router = useRouter()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (data: TUpdateAlertRequest) => putAlert(data),
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: ['alerts'],
        exact: false,
      })
      createToast({
        priority: 'success',
        message: 'Alerte mise à jour avec succès !',
      })
      router.refresh()
    },
    onError: (error: Error) => {
      createToast({
        priority: 'error',
        message: error.message || "Une erreur est survenue lors de la mise à jour de l'alerte.",
      })
    },
  })

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
