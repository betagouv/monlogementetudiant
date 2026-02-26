import { dehydrate, QueryClient } from '@tanstack/react-query'
import { getServerSession } from '~/auth'
import { favoritesQueryKey } from '~/hooks/use-favorites'
import { TGetFavoritesResponse } from '~/schemas/favorites/get-favorites'

export const getFavorites = async (): Promise<TGetFavoritesResponse> => {
  const auth = await getServerSession()
  if (!auth || !auth.session || !auth.session.accessToken) {
    return {
      count: 0,
      results: [],
      next: null,
      previous: null,
      page_size: 0,
    }
  }

  const response = await fetch(`${process.env.API_URL}/accommodations/favorites/`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${auth.session.accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    return {
      count: 0,
      results: [],
      next: null,
      previous: null,
      page_size: 0,
    }
  }

  const data = await response.json()

  return data as TGetFavoritesResponse
}

export const prefetchFavorites = async (queryClient?: QueryClient) => {
  const auth = await getServerSession()
  const client = queryClient ?? new QueryClient()

  await client.prefetchQuery({
    queryKey: favoritesQueryKey(auth?.user?.id),
    queryFn: () => getFavorites(),
  })

  return dehydrate(client)
}
