import { useQuery } from '@tanstack/react-query'
import { TUser } from '~/lib/external-auth-plugin'
import { useTRPC } from '~/server/trpc/client'

export const useFavorites = (user?: TUser) => {
  const trpc = useTRPC()

  const { data, isPending } = useQuery({
    ...trpc.favorites.list.queryOptions(),
    enabled: !!user,
  })

  return {
    data,
    isLoading: isPending,
  }
}
