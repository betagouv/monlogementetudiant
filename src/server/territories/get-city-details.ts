import { getQueryClient, trpc } from '~/server/trpc/server'

export const getCityDetails = (slug: string) => getQueryClient().fetchQuery(trpc.territories.getCityDetails.queryOptions({ slug }))
