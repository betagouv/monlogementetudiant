import { notFound } from 'next/navigation'
import type { TAccomodationDetails } from '~/schemas/accommodations/accommodations'
import { getQueryClient, trpc } from '~/server/trpc/server'

export const getAccommodationById = async (slug: string) => {
  try {
    const data = await getQueryClient().fetchQuery(trpc.accommodations.getBySlug.queryOptions({ slug }))
    return data as TAccomodationDetails
  } catch {
    notFound()
  }
}
