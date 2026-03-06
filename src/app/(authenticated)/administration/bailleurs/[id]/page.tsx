import { OwnerDetail } from './owner-detail'

export default async function OwnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OwnerDetail id={id} />
}
