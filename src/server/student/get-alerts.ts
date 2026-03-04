import { getServerSession } from '~/auth'
import { getQueryClient, trpc } from '~/server/trpc/server'

export const getAlerts = async () => {
  const auth = await getServerSession()
  if (!auth) {
    return {
      count: 0,
      results: [] as Awaited<ReturnType<typeof fetchAlerts>>,
    }
  }

  const alerts = await fetchAlerts()
  return {
    count: alerts.length,
    results: alerts,
  }
}

const fetchAlerts = () => getQueryClient().fetchQuery(trpc.alerts.list.queryOptions())
