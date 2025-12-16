import { TGetAccomodationsResponse } from '~/schemas/accommodations/get-accommodations'

export const getAccommodations = async (searchParams: {
  accessible?: string
  academie?: string
  bbox?: string
  center?: string
  colocation?: string
  prix?: string
  page?: string
  crous?: string
}) => {
  const params = new URLSearchParams()
  if (searchParams.page) params.append('page', searchParams.page)
  if (searchParams.bbox) params.append('bbox', searchParams.bbox)
  if (searchParams.center) {
    params.append('center', searchParams.center)
    params.append('radius', '10')
  }
  if (searchParams.accessible) params.append('is_accessible', searchParams.accessible)
  if (searchParams.colocation) params.append('coliving', searchParams.colocation)
  if (searchParams.prix) params.append('price_max', searchParams.prix)
  if (searchParams.crous) params.append('view_crous', searchParams.crous)
  if (searchParams.academie) params.append('academy_id', searchParams.academie)

  const response = await fetch(`${process.env.API_URL}/accommodations/${params.size > 0 ? `?${params.toString()}` : ''}`)
  if (!response.ok) {
    throw new Error('Error occurred calling API while retrieving accommodations')
  }
  const data = await response.json()
  return data as TGetAccomodationsResponse
}
