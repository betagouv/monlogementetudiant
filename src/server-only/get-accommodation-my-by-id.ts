import { notFound } from 'next/navigation'
import { getServerSession } from '~/auth'
import { TAccomodationMy } from '~/schemas/accommodations/accommodations'

export const getAccommodationMyById = async (slug: string) => {
  const auth = await getServerSession()
  if (!auth || !auth.session) {
    return notFound()
  }

  const response = await fetch(`${process.env.API_URL}/accommodations/my/${slug}/`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${auth.session.accessToken}` },
  })
  if (!response.ok) {
    notFound()
  }
  const data = await response.json()

  return data as TAccomodationMy
}
