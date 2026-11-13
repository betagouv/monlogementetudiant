import { describe, expect, it } from 'vitest'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { shouldShowContactsTab } from '~/utils/contacts-tab-visibility'

describe('shouldShowContactsTab', () => {
  it('shows the tab in none mode for anyone', () => {
    expect(
      shouldShowContactsTab({
        contactMode: EOwnerContactMode.NONE,
        isAdmin: false,
        canManageApplications: false,
        hasApplicationScope: false,
      }),
    ).toBe(true)
  })

  it('keeps permission rules once a mode is active', () => {
    expect(
      shouldShowContactsTab({
        contactMode: EOwnerContactMode.CONTACTS,
        isAdmin: false,
        canManageApplications: false,
        hasApplicationScope: true,
      }),
    ).toBe(false)
    expect(
      shouldShowContactsTab({
        contactMode: EOwnerContactMode.CONTACTS,
        isAdmin: false,
        canManageApplications: true,
        hasApplicationScope: false,
      }),
    ).toBe(false)
    expect(
      shouldShowContactsTab({
        contactMode: EOwnerContactMode.DOSSIER_FACILE,
        isAdmin: false,
        canManageApplications: true,
        hasApplicationScope: true,
      }),
    ).toBe(true)
  })
})
