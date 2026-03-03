import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { useState } from 'react'
import { useDebounce } from 'use-debounce'
import { useTRPC } from '~/server/trpc/client'

export const useSearchCities = (debounceTime = 200) => {
  const trpc = useTRPC()
  const [searchQueryState, setSearchQueryState] = useQueryState('q')

  const [searchQuery, setSearchQuery] = useState(searchQueryState || '')
  const [debouncedSearchQuery] = useDebounce(searchQuery, debounceTime)

  const { data, isError, isLoading } = useQuery({
    ...trpc.territories.search.queryOptions({ q: debouncedSearchQuery }),
    enabled: !!debouncedSearchQuery && debouncedSearchQuery.length >= 2,
    select: (result) => result.cities,
  })
  return {
    data,
    isError,
    isLoading,
    searchQuery,
    searchQueryState,
    setSearchQuery,
    setSearchQueryState,
  }
}
