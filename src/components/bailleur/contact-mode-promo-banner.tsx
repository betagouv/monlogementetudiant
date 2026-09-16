import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { isBailleurAdministrator } from '~/server/bailleur/permissions'
import { getServerSession } from '~/services/better-auth'
import { ContactModePromoBannerClient } from './contact-mode-promo-banner-client'

export const ContactModePromoBanner = async () => {
  const auth = await getServerSession()
  if (!auth?.user) return null

  const canChooseContactMode = isBailleurAdministrator({
    role: auth.user.role,
    bailleurRole: auth.user.bailleurRole ?? null,
    bailleurPermissions: auth.user.bailleurPermissions ?? [],
  })
  if (!canChooseContactMode) return null

  const adminOwners = auth.user.adminOwners ?? []

  return (
    <ContactModePromoBannerClient
      contactMode={auth.user.owner?.contactMode ?? EOwnerContactMode.NONE}
      adminOwners={adminOwners}
      defaultOwnerId={auth.user.owner?.id ?? adminOwners[0]?.id}
    />
  )
}
