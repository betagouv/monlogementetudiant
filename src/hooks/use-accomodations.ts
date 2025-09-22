/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from '@tanstack/react-query'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'

export const fetchAccomodations = async (
  bbox: string | null,
  page: number | null,
  isAccessible: string | null,
  hasColiving: string | null,
  maxPrice: number | null,
): Promise<TGetAccomodationsResponse> => {
  const params = new URLSearchParams()
  if (bbox) params.append('bbox', bbox)
  if (page) params.append('page', page.toString())
  if (isAccessible) params.append('is_accessible', isAccessible)
  if (hasColiving) params.append('has_coliving', hasColiving)
  if (maxPrice) params.append('price_max', maxPrice.toString())

  const response = await fetch(`/api/accommodations${params.size > 0 ? `?${params.toString()}` : ''}`)
  if (!response.ok) {
    throw new Error('Error occurred calling API retrieving accomodations')
  }
  return response.json()
}

interface UseAccomodationsOptions {
  initialData?: TGetAccomodationsResponse
}

export const useAccomodations = ({ initialData }: UseAccomodationsOptions = {}) => {
  const [queryStates] = useQueryStates({
    accessible: parseAsString,
    bbox: parseAsString,
    colocation: parseAsString,
    page: parseAsInteger,
    prix: parseAsInteger,
  })
  const { accessible, bbox, colocation, page, prix } = queryStates
  const enabled = !!bbox || !!accessible || !!page || !!colocation || !!prix

  return useQuery<TGetAccomodationsResponse>({
    enabled,
    initialData: enabled ? undefined : initialData,
    queryFn: () => fetchAccomodations(bbox, page, accessible, colocation, prix),
    queryKey: ['accomodations', { accessible, bbox, colocation, page, prix }],
  })
}
