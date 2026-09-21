'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createToast } from '~/components/ui/createToast'
import { Dropdown } from '~/components/ui/dropdown'
import { TUser } from '~/lib/types'
import { signOut } from '~/services/better-auth-client'
import { buildHref } from '~/utils/preserve-query-params'

export const UserConnectedDropdown = ({ user }: { user: TUser }) => {
  const t = useTranslations('header.userMenu')
  const searchParams = useSearchParams()
  const handleSignout = async () => {
    createToast({
      priority: 'success',
      message: t('signedOutToast'),
    })
    await signOut({
      callbackUrl: '/',
      redirect: true,
    })
  }

  const bailleurWorkspaceUrl = buildHref('/bailleur/tableau-de-bord', searchParams)
  const workspaceUrl = user.role === 'user' ? '/mon-espace' : bailleurWorkspaceUrl
  const isAdmin = user.role === 'admin'
  return (
    <>
      <div className="fr-hidden-sm">
        {isAdmin ? (
          <>
            <Button priority="tertiary no outline" iconId="ri-building-line" linkProps={{ href: bailleurWorkspaceUrl, target: '_self' }}>
              {t('ownerSpace')}
            </Button>
            <Button
              priority="tertiary no outline"
              iconId="ri-shield-user-line"
              linkProps={{ href: '/administration/tableau-de-bord', target: '_self' }}
            >
              {t('adminSpace')}
            </Button>
          </>
        ) : (
          <Button priority="tertiary no outline" iconId="ri-account-circle-line" linkProps={{ href: workspaceUrl, target: '_self' }}>
            {t('mySpace')}
          </Button>
        )}
        <Button priority="tertiary no outline" iconId="fr-icon-logout-box-r-line" onClick={handleSignout}>
          {t('signOut')}
        </Button>
      </div>
      <div className="fr-hidden fr-unhidden-sm">
        <Dropdown id="header_user_menu" alignRight control={user.name} dropdownControlClassName="fr-mb-0">
          <ul>
            {isAdmin ? (
              <>
                <li className="fr-border-top fr-my-md-0 fr-my-1w fr-py-md-0 fr-py-1w fr-px-md-0 fr-px-2w">
                  <Button
                    priority="tertiary no outline"
                    className="fr-text--sm"
                    linkProps={{ href: bailleurWorkspaceUrl, target: '_self' }}
                  >
                    <span className="ri-building-line fr-icon--sm fr-mr-1w fr-text-label--blue-france" />
                    <span className="fr-text-mention--black fr-text--normal">{t('goToOwnerSpace')}</span>
                  </Button>
                </li>
                <li className="fr-border-top fr-my-md-0 fr-my-1w fr-py-md-0 fr-py-1w fr-px-md-0 fr-px-2w">
                  <Button
                    priority="tertiary no outline"
                    className="fr-text--sm"
                    linkProps={{ href: '/administration/tableau-de-bord', target: '_self' }}
                  >
                    <span className="ri-shield-user-line fr-icon--sm fr-mr-1w fr-text-label--blue-france" />
                    <span className="fr-text-mention--black fr-text--normal">{t('goToAdminSpace')}</span>
                  </Button>
                </li>
              </>
            ) : (
              <li className="fr-border-top fr-my-md-0 fr-my-1w fr-py-md-0 fr-py-1w fr-px-md-0 fr-px-2w">
                <Button priority="tertiary no outline" className="fr-text--sm" linkProps={{ href: workspaceUrl, target: '_self' }}>
                  <span className="ri-account-circle-line fr-icon--sm fr-mr-1w fr-text-label--blue-france" />
                  <span className="fr-text-mention--black fr-text--normal">{t('backToMySpace')}</span>
                </Button>
              </li>
            )}
            <li className="fr-border-top fr-border-bottom fr-my-md-0 fr-my-1w fr-py-md-0 fr-py-1w fr-px-md-0 fr-px-2w">
              <Button priority="tertiary no outline" className="fr-text--sm" onClick={handleSignout}>
                <span className="fr-icon-logout-box-r-line fr-icon--sm fr-mr-1w fr-text-label--blue-france" />
                <span className="fr-text-mention--black fr-text--normal">{t('signOutLong')}</span>
              </Button>
            </li>
          </ul>
        </Dropdown>
      </div>
    </>
  )
}
