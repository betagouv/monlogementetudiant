import { auth } from '~/auth'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'

export const getMyAccommodations = async (searchParams: {
  page?: string
  disponible?: string
  recherche?: string
}) => {
  const session = await auth()
  if (!session || !session.accessToken) {
    throw new Error('Unauthorized')
  }

  const params = new URLSearchParams()
  if (searchParams.page) params.append('page', searchParams.page)
  if (searchParams.disponible) params.append('has_availability', searchParams.disponible)
  if (searchParams.recherche) params.append('search', searchParams.recherche)

  const response = await fetch(`${process.env.API_URL}/accommodations/my/${params.size > 0 ? `?${params.toString()}` : ''}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error('Error occurred calling API while retrieving accommodations/my')
  }
  const data = await response.json()
  return data as TGetAccomodationsResponse
}
