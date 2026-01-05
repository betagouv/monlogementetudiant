import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'
import { TPostFavorite } from '~/schemas/favorites/create-favorite'

export const postFavorite = async (body: TPostFavorite): Promise<void> => {
  const response = await fetch('/api/accommodations/favorites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error('Failed to save favorite')
  }

  return response.json()
}

export const useCreateFavorite = () => {
  const queryClient = useQueryClient()

  const router = useRouter()
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (data: TPostFavorite) => postFavorite(data),
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: ['favorites'],
        exact: false,
      })
      createToast({
        priority: 'success',
        message: 'Logement ajouté aux favoris !',
      })
      router.refresh()
    },
    onError: (error: Error) => {
      createToast({
        priority: 'error',
        message: error.message || "Une erreur est survenue lors de l'ajout aux favoris.",
      })
    },
  })

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
