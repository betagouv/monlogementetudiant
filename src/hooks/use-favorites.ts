import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { TGetFavoritesResponse } from '~/schemas/favorites/get-favorites'

export const getFavorites = async (): Promise<TGetFavoritesResponse> => {
  const response = await fetch('/api/accommodations/favorites', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to get favorites')
  }

  return response.json()
}

export const useFavorites = (initialData?: TGetFavoritesResponse | null) => {
  const { data: session } = useSession()

  const { data, isPending } = useQuery({
    enabled: !!session?.user,
    queryFn: getFavorites,
    queryKey: ['favorites', session?.user?.id],
    initialData: initialData ?? undefined,
  })

  return {
    data,
    isLoading: isPending,
  }
}
