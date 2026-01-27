import { notFound } from 'next/navigation'
import { getServerSession } from '~/auth'
import { TGetFavoritesResponse } from '~/schemas/favorites/get-favorites'

export const getFavorites = async (): Promise<TGetFavoritesResponse> => {
  const auth = await getServerSession()
  if (!auth || !auth.session) {
    return notFound()
  }

  const response = await fetch(`${process.env.API_URL}/accommodations/favorites/`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${auth.session.accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch favorites: ${response.status}`)
  }

  const data = await response.json()

  return data as TGetFavoritesResponse
}
