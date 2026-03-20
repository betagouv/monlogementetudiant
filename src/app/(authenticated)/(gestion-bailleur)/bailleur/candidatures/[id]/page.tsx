import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { notFound } from 'next/navigation'
import { CandidatureDetail } from '~/components/bailleur/candidatures/candidature-detail'
import { getQueryClient, trpc } from '~/server/trpc/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = {
  params: Promise<{ id: string }>
}

export default async function CandidatureDetailPage({ params }: Props) {
  const { id } = await params
  const candidatureId = Number(id)

  if (isNaN(candidatureId)) return notFound()

  const queryClient = getQueryClient()

  await queryClient.prefetchQuery(trpc.bailleur.getCandidature.queryOptions({ id: candidatureId }))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CandidatureDetail id={candidatureId} />
    </HydrationBoundary>
  )
}
