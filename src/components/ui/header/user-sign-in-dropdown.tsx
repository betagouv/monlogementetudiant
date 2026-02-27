'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { Dropdown } from '~/components/ui/dropdown'

export const UserSignInDropdown = () => {
  return (
    <>
      <div className="fr-hidden-sm">
        <Button priority="tertiary no outline" iconId="ri-account-circle-line" linkProps={{ href: '/se-connecter', target: '_self' }}>
          Espace Étudiant
        </Button>
        <Button
          priority="tertiary no outline"
          iconId="ri-building-line"
          linkProps={{ href: '/gestionnaire/se-connecter', target: '_self' }}
        >
          Espace Gestionnaire
        </Button>
      </div>
      <div className="fr-hidden fr-unhidden-sm">
        <Dropdown id="header_sign_in_user_menu" alignRight control="Se connecter" dropdownControlClassName="fr-mb-0">
          <ul>
            <li className="fr-border-top fr-my-md-0 fr-my-1w fr-py-md-0 fr-py-1w fr-px-md-0 fr-px-2w">
              <Button priority="tertiary no outline" className="fr-text--sm" linkProps={{ href: '/se-connecter', target: '_self' }}>
                <span className="ri-account-circle-line fr-icon--sm fr-mr-1w fr-text-label--blue-france" />
                <span className="fr-text-mention--black fr-text--normal">Espace Étudiant</span>
              </Button>
            </li>
            <li className="fr-border-top fr-border-bottom fr-my-md-0 fr-my-1w fr-py-md-0 fr-py-1w fr-px-md-0 fr-px-2w">
              <Button
                priority="tertiary no outline"
                className="fr-text--sm"
                linkProps={{ href: '/gestionnaire/se-connecter', target: '_self' }}
              >
                <span className="ri-building-line fr-icon--sm fr-mr-1w fr-text-label--blue-france" />
                <span className="fr-text-mention--black fr-text--normal">Espace Gestionnaire</span>
              </Button>
            </li>
          </ul>
        </Dropdown>
      </div>
    </>
  )
}
