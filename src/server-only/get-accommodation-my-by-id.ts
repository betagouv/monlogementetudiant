import { notFound } from 'next/navigation'
import { auth } from '~/auth'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'

export const getAccommodationMyById = async (slug: string) => {
  const session = await auth()
  if (!session || !session.accessToken) {
    throw new Error('Unauthorized')
  }

  const response = await fetch(`${process.env.API_URL}/accommodations/my/${slug}/`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })
  if (!response.ok) {
    notFound()
  }
  const data = await response.json()

  return data as TAccomodationMy
}
