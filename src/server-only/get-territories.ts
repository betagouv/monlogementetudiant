import { getQueryClient, trpc } from '~/server/trpc/server'

export const getTerritories = (q: string) => getQueryClient().fetchQuery(trpc.territories.search.queryOptions({ q }))
