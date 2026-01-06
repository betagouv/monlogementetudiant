import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { TCreateAlertRequest } from '~/schemas/alerts/create-alert'

export const postAlert = async (body: TCreateAlertRequest): Promise<void> => {
  const response = await fetch('/api/alerts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error('Failed to create alert')
  }

  return response.json()
}

export const useCreateAlert = () => {
  const queryClient = useQueryClient()
  const router = useRouter()

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (data: TCreateAlertRequest) => postAlert(data),
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: ['alerts'],
        exact: false,
      })
      createToast({
        priority: 'success',
        message: 'Alerte créée avec succès !',
      })
      router.refresh()
    },
    onError: (error: Error) => {
      createToast({
        priority: 'error',
        message: error.message || "Une erreur est survenue lors de la création de l'alerte.",
      })
    },
  })

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
