import { getServerSession } from '~/services/better-auth'
import { ImpersonationBannerClient } from './impersonation-banner-client'

/** À monter sous l'en-tête de chaque layout authentifié : une usurpation peut arriver sur n'importe quel espace. */
export const ImpersonationBanner = async () => {
  const session = await getServerSession()
  if (!session?.session.impersonatedBy) return null

  const { firstname, lastname, name, email } = session.user
  const displayName = `${firstname ?? ''} ${lastname ?? ''}`.trim() || name

  return <ImpersonationBannerClient name={displayName} email={email} />
}
