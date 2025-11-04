import { notFound } from 'next/navigation'
import { TAccomodationDetails } from '~/schemas/accommodations/accommodations'

export const getAccommodationById = async (slug: string) => {
  const response = await fetch(`${process.env.API_URL}/accommodations/${slug}/`, { cache: 'no-store' })

  if (!response.ok) {
    notFound()
  }
  const data = await response.json()

  return data as TAccomodationDetails
}
