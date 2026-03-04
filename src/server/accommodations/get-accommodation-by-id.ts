import { getQueryClient, trpc } from '~/server/trpc/server'

export const getAccommodationById = (slug: string) => getQueryClient().fetchQuery(trpc.accommodations.getBySlug.queryOptions({ slug }))
