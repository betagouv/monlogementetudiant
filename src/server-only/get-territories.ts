import { TTerritories } from '~/schemas/territories'
import { getQueryClient, trpc } from '~/server/trpc/server'

export const getTerritories = async (q: string): Promise<TTerritories> => {
  return getQueryClient().fetchQuery(trpc.territories.search.queryOptions({ q }))
}
