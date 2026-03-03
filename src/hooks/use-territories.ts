import { useQuery } from '@tanstack/react-query'
import { useQueryState } from 'nuqs'
import { useState } from 'react'
import { useDebounce } from 'use-debounce'
import { useTRPC } from '~/server/trpc/client'

export const useTerritories = (debounceTime = 200) => {
  const trpc = useTRPC()
  const [searchQueryState] = useQueryState('q')

  const [searchQuery, setSearchQuery] = useState(searchQueryState || '')
  const [debouncedSearchQuery] = useDebounce(searchQuery, debounceTime)

  const { data, isError, isLoading } = useQuery({
    ...trpc.territories.search.queryOptions({ q: debouncedSearchQuery }),
    enabled: !!debouncedSearchQuery && debouncedSearchQuery.length >= 2,
  })
  return {
    data,
    isError,
    isLoading,
    searchQuery,
    setSearchQuery,
  }
}
