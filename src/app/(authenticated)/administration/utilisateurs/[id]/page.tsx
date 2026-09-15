import { getServerSession } from '~/services/better-auth'
import { UserDetail } from './user-detail'

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession()

  // Sert uniquement à masquer l'usurpation de son propre compte : la vraie garde est le
  // plugin `admin` de Better Auth, qui exige le rôle `admin` sur l'endpoint.
  return <UserDetail id={id} currentUserId={session?.user.id ?? null} />
}
