import { getQueryClient, trpc } from '~/server/trpc/server'
import { getServerSession } from '~/services/better-auth'

export const getBudgetSimulation = async () => {
  const auth = await getServerSession()
  if (!auth) return null

  return getQueryClient().fetchQuery(trpc.budgetSimulation.get.queryOptions())
}
