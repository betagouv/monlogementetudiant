import { fr } from '@codegouvfr/react-dsfr'
import { Button } from '@codegouvfr/react-dsfr/Button'
import { Header } from '@codegouvfr/react-dsfr/Header'
import { getTranslations } from 'next-intl/server'
import { FC } from 'react'
import { z } from 'zod'
import { BrandTop } from '~/components/ui/brand-top'
import { Banner } from '~/components/ui/header/banner/banner'
import { HeaderNavigation } from '~/components/ui/header/navigation'
import logo from '~/images/logo.svg'

export const HeaderComponent: FC = async () => {
  const t = await getTranslations()
  const tallyUrl = z.string().parse(process.env.NEXT_PUBLIC_TALLY_URL)
  return (
    <div>
      <Header
        homeLinkProps={{
          href: '/',
          title: t('metadata.homeLinkTitle'),
        }}
        quickAccessItems={[
          <Button key="faq-cta" priority="tertiary no outline" iconId="ri-question-line" linkProps={{ href: '/faq', target: '_self' }}>
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
          <Button priority="tertiary" key="tally-cta" linkProps={{ href: tallyUrl, target: '_blank' }}>
            {t('header.tally')}
          </Button>,
          // <Button priority="tertiary" key="login-cta" iconId="ri-user-line" linkProps={{ href: '/se-connecter', target: '_self' }}>
          //   {t('header.login')}
          // </Button>,
        ]}
        brandTop={<BrandTop />}
        serviceTagline={t('header.description')}
        serviceTitle={
          <>
            {t('header.title')}
            <span className={fr.cx('fr-ml-1w', 'fr-badge', 'fr-badge--success', 'fr-badge--no-icon')}>Beta</span>
          </>
        }
        // navigation={<HeaderNavigation academies={academies} />}
        navigation={<HeaderNavigation />}
        className={fr.cx('fr-header')}
        operatorLogo={{
          alt: 'Mon logement étudiant - logo',
          imgUrl: logo.src,
          orientation: 'horizontal',
        }}
      />
      <Banner />
    </div>
  )
}
