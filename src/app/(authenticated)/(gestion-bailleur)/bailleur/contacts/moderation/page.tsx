import { redirect } from 'next/navigation'
import { buildHref } from '~/utils/preserve-query-params'

type PageProps = {
  searchParams: Promise<{ ownerId?: string }>
}

export default async function ModerationSettingsPage({ searchParams }: PageProps) {
  redirect(buildHref('/bailleur/contacts/parametres', await searchParams))
}
