import { getServerSession } from '~/auth'
import { getQueryClient, trpc } from '~/server/trpc/server'

export const getFavorites = async () => {
  const auth = await getServerSession()
  if (!auth) {
    return {
      count: 0,
      results: [] as Awaited<ReturnType<typeof fetchFavorites>>,
    }
  }

  const favorites = await fetchFavorites()
  return {
    count: favorites.length,
    results: favorites,
  }
}

const fetchFavorites = () => getQueryClient().fetchQuery(trpc.favorites.list.queryOptions())
