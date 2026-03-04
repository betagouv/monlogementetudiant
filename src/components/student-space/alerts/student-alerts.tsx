import { StudentAlert } from '~/components/student-space/alerts/student-alert'
import { getAlerts } from '~/server/student/get-alerts'

export const StudentAlerts = async () => {
  const alertsResponse = await getAlerts()

  return alertsResponse.results.map((alert) => <StudentAlert key={alert.id} alert={alert} />)
}
