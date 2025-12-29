'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { signOut } from 'next-auth/react'
import { createToast } from '~/components/ui/createToast'
import { Dropdown } from '~/components/ui/dropdown'
import { TUser } from '~/types/next-auth'

export const UserConnectedDropdown = ({ user }: { user: TUser }) => {
  const handleSignout = async () => {
    await signOut({
      redirectTo: '/',
    })
    createToast({
      priority: 'success',
      message: 'Vous êtes maintenant déconnecté',
    })
  }

  const workspaceUrl = user.role === 'owner' ? `/bailleur/tableau-de-bord` : '/mon-espace'
  return (
    <Dropdown id="header_user_menu" alignRight control={user.name} dropdownControlClassName="fr-mb-0">
      <ul>
        <li className="fr-border-top fr-my-md-0 fr-my-1w fr-py-md-0 fr-py-1w fr-px-md-0 fr-px-2w">
          <Button priority="tertiary no outline" className="fr-text--sm" linkProps={{ href: workspaceUrl, target: '_self' }}>
            <span className="ri-account-circle-line fr-icon--sm fr-mr-1w fr-text-label--blue-france" />
            <span className="fr-text-mention--black fr-text--normal">Revenir à mon espace</span>
          </Button>
        </li>
        <li className="fr-border-top fr-border-bottom fr-my-md-0 fr-my-1w fr-py-md-0 fr-py-1w fr-px-md-0 fr-px-2w">
          <Button priority="tertiary no outline" className="fr-text--sm" onClick={handleSignout}>
            <span className="fr-icon-logout-box-r-line fr-icon--sm fr-mr-1w fr-text-label--blue-france" />
            <span className="fr-text-mention--black fr-text--normal">Se déconnecter</span>
          </Button>
        </li>
      </ul>
    </Dropdown>
  )
}
