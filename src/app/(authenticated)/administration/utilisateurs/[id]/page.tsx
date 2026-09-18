import { getServerSession } from '~/services/better-auth'
import { UserDetail } from './user-detail'

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession()

  // Masque l'usurpation de son propre compte à l'affichage ; l'autorisation est vérifiée côté
  // serveur par le plugin `admin` de Better Auth.
  return <UserDetail id={id} currentUserId={session?.user.id ?? null} />
}
