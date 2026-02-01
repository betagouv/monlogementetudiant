import { getServerSession } from '~/auth'
import { TGetAlertsResponse } from '~/schemas/alerts/get-alerts'

export const getAlerts = async (): Promise<TGetAlertsResponse> => {
  const auth = await getServerSession()
  if (!auth || !auth.session || !auth.session.accessToken) {
    throw new Error('Unauthorized')
  }

  const response = await fetch(`${process.env.API_URL}/alerts/`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${auth.session.accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch alerts: ${response.status}`)
  }

  const data = await response.json()

  return data as TGetAlertsResponse
}
