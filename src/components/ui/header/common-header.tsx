import { Button } from '@codegouvfr/react-dsfr/Button'
import { Header } from '@codegouvfr/react-dsfr/Header'
import { getTranslations } from 'next-intl/server'
import { FC } from 'react'
import { BrandTop } from '~/components/ui/brand-top'
import { Banner } from '~/components/ui/header/banner/banner'
import { HeaderNavigation } from '~/components/ui/header/navigation'
import { UserConnectedDropdown } from '~/components/ui/header/user-connected-dropdown'
import { UserSignInDropdown } from '~/components/ui/header/user-sign-in-dropdown'
import { getServerSession } from '~/services/better-auth'

type CommonHeaderProps = {
  withNavigation?: boolean
}

export const CommonHeader: FC<CommonHeaderProps> = async ({ withNavigation = true }) => {
  const t = await getTranslations()
  const auth = await getServerSession()

  return (
    <div>
      <Header
        homeLinkProps={{
          href: '/',
          title: t('metadata.home.title'),
        }}
        quickAccessItems={[
          <Button
            key="faq-cta"
            priority="tertiary no outline"
            iconId="ri-question-line"
            linkProps={{ href: '/foire-aux-questions', target: '_self' }}
          >
            {t('navigation.faq')}
          </Button>,
          <Button
            priority="tertiary no outline"
            key="alerts-cta"
            iconId="ri-notification-3-line"
            linkProps={{ href: '/alerte-logement', target: '_self' }}
          >
            {t('header.alerts')}
          </Button>,
          auth?.user ? <UserConnectedDropdown key="user-dropdown" user={auth.user} /> : <UserSignInDropdown key="user-sign-in-dropdown" />,
        ]}
        brandTop={<BrandTop />}
        serviceTagline={t('header.description')}
        serviceTitle={
          <>
            {t('header.title')}
            <span className={'fr-ml-1w fr-badge fr-badge--success fr-badge--no-icon'}>Beta</span>
          </>
        }
        {...(!!withNavigation && { navigation: <HeaderNavigation /> })}
        className="fr-header"
      />
      <Banner />
    </div>
  )
}
