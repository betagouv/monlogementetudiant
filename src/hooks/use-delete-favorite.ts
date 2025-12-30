import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createToast } from '~/components/ui/createToast'

export const deleteFavorite = async (slug: string): Promise<void> => {
  const response = await fetch(`/api/accommodations/favorites/${slug}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to delete favorite')
  }

  return response.json()
}

export const useDeleteFavorite = () => {
  const router = useRouter()
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (slug: string) => deleteFavorite(slug),
    onSuccess: () => {
      createToast({
        priority: 'success',
        message: 'Logement supprimé des favoris !',
      })
      router.refresh()
    },
    onError: (error: Error) => {
      createToast({
        priority: 'error',
        message: error.message || 'Une erreur est survenue lors de la suppression des favoris.',
      })
    },
  })

  return {
    mutateAsync,
    isLoading: isPending,
  }
}
