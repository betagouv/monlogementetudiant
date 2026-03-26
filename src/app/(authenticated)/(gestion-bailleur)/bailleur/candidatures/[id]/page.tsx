import { HydrationBoundary } from '@tanstack/react-query'
import { notFound } from 'next/navigation'
import { CandidatureDetail } from '~/components/bailleur/candidatures/candidature-detail'
import { getCandidateDetailsPageContext } from './get-candidate-details-page-context'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Props = {
  params: Promise<{ id: string }>
}

export default async function CandidatureDetailPage({ params }: Props) {
  const { id } = await params

  if (!UUID_REGEX.test(id)) return notFound()

  const { dehydratedState } = await getCandidateDetailsPageContext(id)

  return (
    <HydrationBoundary state={dehydratedState}>
      <CandidatureDetail id={id} />
    </HydrationBoundary>
  )
}
