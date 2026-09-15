import { getServerSession } from '~/services/better-auth'
import { ImpersonationBannerClient } from './impersonation-banner-client'

/**
 * Needs to be mounted in each layout with auth below the header since an impersonation can land any where
 */
export const ImpersonationBanner = async () => {
  const session = await getServerSession()
  if (!session?.session.impersonatedBy) return null

  const { firstname, lastname, name, email } = session.user
  const displayName = `${firstname ?? ''} ${lastname ?? ''}`.trim() || name

  return <ImpersonationBannerClient name={displayName} email={email} />
}
