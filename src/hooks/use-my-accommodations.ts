'use client'

import { useQuery } from '@tanstack/react-query'
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { useDebounce } from 'use-debounce'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'

export const fetchMyAccommodations = async (
  page: number | null,
  disponible: boolean | null,
  recherche: string | null,
): Promise<TGetAccomodationsResponse> => {
  const params = new URLSearchParams()
  if (page) params.append('page', page.toString())
  if (disponible !== null) params.append('has_availability', disponible.toString())
  if (recherche && recherche.length >= 3) params.append('search', recherche)

  const response = await fetch(`/api/accommodations/my${params.size > 0 ? `?${params.toString()}` : ''}`)
  if (!response.ok) {
    throw new Error('Error occurred calling API retrieving my accommodations')
  }
  return response.json()
}

interface UseMyAccommodationsOptions {
  debounceTime?: number
}

export const useMyAccommodations = ({ debounceTime = 300 }: UseMyAccommodationsOptions = {}) => {
  const [queryStates] = useQueryStates({
    page: parseAsInteger,
    disponible: parseAsBoolean,
    recherche: parseAsString,
  })

  const { page, disponible, recherche } = queryStates
  const [debouncedRecherche] = useDebounce(recherche, debounceTime)

  // Enable query when filters are active or search is valid
  const enabled =
    page !== null || disponible !== null || debouncedRecherche === null || debouncedRecherche.length === 0 || debouncedRecherche.length >= 3

  return useQuery<TGetAccomodationsResponse>({
    enabled,
    queryFn: () => fetchMyAccommodations(page, disponible, debouncedRecherche),
    queryKey: ['my-accommodations', page, disponible, debouncedRecherche],
  })
}
