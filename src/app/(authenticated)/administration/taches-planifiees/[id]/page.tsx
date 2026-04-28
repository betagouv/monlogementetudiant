import { CronJobDetail } from '~/components/administration/taches-planifiees/cron-job-detail'

export const metadata = {
  title: 'Détail tâche — Administration',
}

export default async function CronJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CronJobDetail id={id} />
}
