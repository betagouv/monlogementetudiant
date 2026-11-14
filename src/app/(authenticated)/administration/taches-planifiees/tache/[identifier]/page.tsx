import { JobRunHistory } from '~/components/administration/taches-planifiees/job-run-history'

export const metadata = {
  title: 'Historique tâche — Administration',
}

export default async function JobRunHistoryPage({ params }: { params: Promise<{ identifier: string }> }) {
  const { identifier } = await params
  return <JobRunHistory identifier={identifier} />
}
