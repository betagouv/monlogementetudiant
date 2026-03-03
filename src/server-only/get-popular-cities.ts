import { TCity } from '~/schemas/territories'
import { getQueryClient, trpc } from '~/server/trpc/server'

export const getPopularCities = async (): Promise<TCity[]> => {
  return getQueryClient().fetchQuery(trpc.territories.listCities.queryOptions({ popular: true }))
}
