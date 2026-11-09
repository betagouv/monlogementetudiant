import { EOwnerContactMode } from '~/enums/owner-contact-mode'

type ContactsTabVisibilityInput = {
  contactMode: EOwnerContactMode
  isAdmin: boolean
  canManageApplications: boolean
  hasApplicationScope: boolean
}

export const shouldShowContactsTab = ({ contactMode, canManageApplications, hasApplicationScope }: ContactsTabVisibilityInput): boolean =>
  contactMode === EOwnerContactMode.NONE || (canManageApplications && hasApplicationScope)
