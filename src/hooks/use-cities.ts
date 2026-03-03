import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { useTRPC } from '~/server/trpc/client'

export const useCities = () => {
  const trpc = useTRPC()
  const [departmentCode] = useQueryState('department')

  const { data, isError, isLoading } = useQuery({
    ...trpc.territories.listCities.queryOptions(departmentCode ? { departmentCode } : { popular: true }),
    enabled: !!departmentCode,
  })
  return {
    data,
    isError,
    isLoading,
  }
}
