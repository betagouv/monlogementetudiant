'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { signOut } from '~/auth-client'
import { createToast } from '~/components/ui/createToast'
import { Dropdown } from '~/components/ui/dropdown'
import { TUser } from '~/lib/external-auth-plugin'

export const UserConnectedDropdown = ({ user }: { user: TUser }) => {
  const handleSignout = async () => {
    createToast({
      priority: 'success',
      message: 'Vous êtes maintenant déconnecté',
    })
    await signOut({
      callbackUrl: '/',
      redirect: true,
    })
  }

  const workspaceUrl = user.role === 'user' ? '/mon-espace' : '/bailleur/tableau-de-bord'
  return (
    <>
      <div className="fr-hidden-sm">
        <Button priority="tertiary no outline" iconId="ri-account-circle-line" linkProps={{ href: workspaceUrl, target: '_self' }}>
          Mon espace
        </Button>
        <Button priority="tertiary no outline" iconId="fr-icon-logout-box-r-line" onClick={handleSignout}>
          Déconnexion
        </Button>
      </div>
      <div className="fr-hidden fr-unhidden-sm">
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
      </div>
    </>
  )
}
