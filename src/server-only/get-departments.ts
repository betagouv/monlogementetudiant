import { TDepartments } from '~/schemas/departments'
import { getQueryClient, trpc } from '~/server/trpc/server'

export const getDepartments = async (): Promise<TDepartments> => {
  return getQueryClient().fetchQuery(trpc.territories.listDepartments.queryOptions())
}
