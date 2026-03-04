import { getQueryClient, trpc } from '~/server/trpc/server'

export const getPopularCities = () => getQueryClient().fetchQuery(trpc.territories.listCities.queryOptions({ popular: true }))
