import { dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { getBailleurContext } from '~/server/bailleur/get-bailleur-context'
import { getQueryClient, trpc } from '~/server/trpc/server'
import { buildHref } from '~/utils/preserve-query-params'

type SearchParams = {
  ownerId?: string
}

export const getModerationPageContext = cache(async (searchParams: SearchParams) => {
  const ctx = await getBailleurContext(searchParams.ownerId)

  if (!ctx.isAdministrator) redirect(buildHref('/bailleur/tableau-de-bord', searchParams))

  if (ctx.owner.contactMode === EOwnerContactMode.NONE) redirect(buildHref('/bailleur/contacts', searchParams))

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(trpc.bailleur.users.list.queryOptions({ ownerId: ctx.owner.id }))

  return {
    dehydratedState: dehydrate(queryClient),
    ctx,
  }
})
