import { TRPCError } from '@trpc/server'
import { notFound } from 'next/navigation'
import { getQueryClient, trpc } from '~/server/trpc/server'

export const getAccommodationById = async (slug: string) => {
  try {
    return await getQueryClient().fetchQuery(trpc.accommodations.getBySlug.queryOptions({ slug }))
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'NOT_FOUND') notFound()
    throw err
  }
}
