'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { Dropdown } from '~/components/ui/dropdown'

export const UserSignInDropdown = () => {
  const t = useTranslations('header')

  return (
    <>
      <div className="fr-hidden-sm">
        <Button priority="tertiary no outline" iconId="ri-account-circle-line" linkProps={{ href: '/se-connecter', target: '_self' }}>
          {t('studentSpace')}
        </Button>
        <Button
          priority="tertiary no outline"
          iconId="ri-building-line"
          linkProps={{ href: '/gestionnaire/se-connecter', target: '_self' }}
        >
          {t('ownerSpace')}
        </Button>
      </div>
      <div className="fr-hidden fr-unhidden-sm">
        <Dropdown id="header_sign_in_user_menu" alignRight control={t('login')} dropdownControlClassName="fr-mb-0">
          <ul>
            <li className="fr-border-top fr-my-md-0 fr-my-1w fr-py-md-0 fr-py-1w fr-px-md-0 fr-px-2w">
              <Button priority="tertiary no outline" className="fr-text--sm" linkProps={{ href: '/se-connecter', target: '_self' }}>
                <span className="ri-account-circle-line fr-icon--sm fr-mr-1w fr-text-label--blue-france" />
                <span className="fr-text-mention--black fr-text--normal">{t('studentSpace')}</span>
              </Button>
            </li>
            <li className="fr-border-top fr-border-bottom fr-my-md-0 fr-my-1w fr-py-md-0 fr-py-1w fr-px-md-0 fr-px-2w">
              <Button
                priority="tertiary no outline"
                className="fr-text--sm"
                linkProps={{ href: '/gestionnaire/se-connecter', target: '_self' }}
              >
                <span className="ri-building-line fr-icon--sm fr-mr-1w fr-text-label--blue-france" />
                <span className="fr-text-mention--black fr-text--normal">{t('ownerSpace')}</span>
              </Button>
            </li>
          </ul>
        </Dropdown>
      </div>
    </>
  )
}
