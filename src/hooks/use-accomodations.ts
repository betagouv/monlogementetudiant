import { useQuery } from '@tanstack/react-query'
import { useQueryStates } from 'nuqs'
import { accommodationsParsers, accommodationsQueryKey } from '~/lib/accommodations-search-params'
import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'

export const fetchAccomodations = async (
  bbox: string | null,
  page: number | null,
  isAccessible: string | null,
  hasColiving: string | null,
  maxPrice: number | null,
  crous: string | null,
  academie: string | null,
  pageSize?: number,
): Promise<TGetAccomodationsResponse> => {
  const params = new URLSearchParams()
  if (bbox) params.append('bbox', bbox)
  if (page) params.append('page', page.toString())
  if (isAccessible) params.append('is_accessible', isAccessible)
  if (hasColiving) params.append('has_coliving', hasColiving)
  if (maxPrice) params.append('price_max', maxPrice.toString())
  if (crous) params.append('view_crous', crous)
  if (academie) params.append('academy_id', academie)
  if (pageSize) params.append('page_size', pageSize.toString())

  const response = await fetch(`/api/accommodations${params.size > 0 ? `?${params.toString()}` : ''}`)
  if (!response.ok) {
    return {
      count: 0,
      next: null,
      previous: null,
      min_price: null,
      max_price: null,
      page_size: 15,
      results: {
        features: [],
      },
    }
  }
  return response.json()
}

interface UseAccomodationsOptions {
  pageSize?: number
}

export const useAccomodations = ({ pageSize }: UseAccomodationsOptions = {}) => {
  const [queryStates] = useQueryStates(accommodationsParsers)
  const { bbox, academie, accessible, colocation, page, prix, crous } = queryStates
  const enabled = !!bbox || !!accessible || !!page || !!colocation || !!prix || !!crous || !!academie

  return useQuery<TGetAccomodationsResponse>({
    enabled,
    queryFn: () => fetchAccomodations(bbox, page, accessible, colocation, prix, crous, academie, pageSize),
    queryKey: accommodationsQueryKey({ accessible, bbox, colocation, page, prix, crous, academie, pageSize }),
  })
}
