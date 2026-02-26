import { useQuery } from '@tanstack/react-query'
import { TUser } from '~/lib/external-auth-plugin'
import { TGetFavoritesResponse } from '~/schemas/favorites/get-favorites'

export const favoritesQueryKey = (userId?: string) => ['favorites', userId] as const

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

export const useFavorites = (user?: TUser) => {
  const { data, isPending } = useQuery({
    enabled: !!user,
    queryFn: getFavorites,
    queryKey: favoritesQueryKey(user?.id),
  })

  return {
    data,
    isLoading: isPending,
  }
}
