import { QueryClient } from '@tanstack/react-query'
import { getServerSession } from '~/auth'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'

export const myAccommodationsQueryKey = (page?: string | null, disponible?: string | null, recherche?: string | null) =>
  ['my-accommodations', page ? Number(page) : null, disponible === 'true' ? true : null, recherche || null] as const

export const getMyAccommodations = async (searchParams?: { page?: string; disponible?: string; recherche?: string }) => {
  const auth = await getServerSession()

  if (!auth || !auth.session.accessToken) {
    throw new Error('Unauthorized')
  }

  const params = new URLSearchParams()
  if (searchParams?.page) params.append('page', searchParams.page)
  if (searchParams?.disponible) params.append('has_availability', searchParams.disponible)
  if (searchParams?.recherche) params.append('search', searchParams.recherche)

  const response = await fetch(`${process.env.API_URL}/accommodations/my/${params.size > 0 ? `?${params.toString()}` : ''}`, {
    headers: {
      Authorization: `Bearer ${auth.session.accessToken}`,
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

export const prefetchMyAccommodations = async (searchParams?: { page?: string; disponible?: string; recherche?: string }) => {
  const queryClient = new QueryClient()

  await queryClient.prefetchQuery({
    queryKey: myAccommodationsQueryKey(searchParams?.page, searchParams?.disponible, searchParams?.recherche),
    queryFn: () => getMyAccommodations(searchParams),
  })

  return queryClient
}
