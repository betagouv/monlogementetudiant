import { auth } from '~/auth'
import { TGetAlertsResponse } from '~/schemas/alerts/get-alerts'

export const getAlerts = async (): Promise<TGetAlertsResponse> => {
  const session = await auth()
  if (!session || !session.accessToken) {
    throw new Error('Unauthorized')
  }

  const response = await fetch(`${process.env.API_URL}/alerts/`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch alerts: ${response.status}`)
  }

  const data = await response.json()

  return data as TGetAlertsResponse
}
