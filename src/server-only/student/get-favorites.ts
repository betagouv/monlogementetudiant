import { auth } from '~/auth'
import { TGetFavoritesResponse } from '~/schemas/favorites/get-favorites'

export const getFavorites = async (): Promise<TGetFavoritesResponse> => {
  const session = await auth()
  if (!session || !session.accessToken) {
    throw new Error('Unauthorized')
  }

  const response = await fetch(`${process.env.API_URL}/accommodations/favorites/`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch favorites: ${response.status}`)
  }

  const data = await response.json()

  return data as TGetFavoritesResponse
}
