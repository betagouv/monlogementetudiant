import { TCity } from '~/schemas/territories'
import { getQueryClient, trpc } from '~/server/trpc/server'

export const getCityDetails = async (slug: string): Promise<TCity> => {
  return getQueryClient().fetchQuery(trpc.territories.getCityDetails.queryOptions({ slug }))
}
