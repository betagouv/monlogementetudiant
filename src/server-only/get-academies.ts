import { TAcademyOrDepartment } from '~/schemas/territories'
import { getQueryClient, trpc } from '~/server/trpc/server'

export const getAcademies = async (): Promise<TAcademyOrDepartment[]> => {
  return getQueryClient().fetchQuery(trpc.territories.listAcademies.queryOptions())
}
