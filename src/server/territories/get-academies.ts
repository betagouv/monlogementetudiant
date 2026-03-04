import { getQueryClient, trpc } from '~/server/trpc/server'

export const getAcademies = () => getQueryClient().fetchQuery(trpc.territories.listAcademies.queryOptions())
