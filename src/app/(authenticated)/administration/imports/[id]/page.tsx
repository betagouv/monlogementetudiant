import { ImportJobDetail } from './import-job-detail'

export const metadata = {
  title: 'Détail import — Administration',
}

export default async function ImportJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ImportJobDetail id={id} />
}
