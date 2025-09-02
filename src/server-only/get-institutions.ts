import { TGetInstitutionsResponse } from '~/schemas/institutions/institution'

export const getInstitutions = async (longitude: number, latitude: number) => {
  const params = new URLSearchParams()
  params.append('center', `${longitude},${latitude}`)
  const response = await fetch(`${process.env.API_URL}/institutions/educational-institutions/?${params.toString()}`, {
    next: { revalidate: 60 * 60 * 24 },
  })

  if (!response.ok) {
    throw new Error('Error occurred calling API while retrieving institutions')
  }
  const data = await response.json()

  return data as Promise<TGetInstitutionsResponse>
}
