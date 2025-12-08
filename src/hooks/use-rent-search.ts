import { useQuery } from '@tanstack/react-query'
import { TRentSearchResponse, ZRentSearchResponse } from '~/schemas/territories'

async function searchRentData(query: string): Promise<TRentSearchResponse> {
  if (!query.trim()) {
    return { cities: [], total: 0 }
  }

  const response = await fetch(`/api/territories/rent-search?q=${encodeURIComponent(query)}`)

  if (!response.ok) {
    throw new Error('Failed to search rent data')
  }

  const data = await response.json()
  return ZRentSearchResponse.parse(data)
}

export function useRentSearch(query: string) {
  return useQuery({
    queryKey: ['rent-search', query],
    queryFn: () => searchRentData(query),
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
