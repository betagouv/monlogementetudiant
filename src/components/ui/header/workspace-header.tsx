import { fr } from '@codegouvfr/react-dsfr'
import { Button } from '@codegouvfr/react-dsfr/Button'
import { Header } from '@codegouvfr/react-dsfr/Header'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { FC } from 'react'
import { auth } from '~/auth'
import { BrandTop } from '~/components/ui/brand-top'
import { WorkspaceHeaderNavigation } from '~/components/ui/header/workspace-navigation'
import logo from '~/images/logo.svg'

export const WorkspaceHeaderComponent: FC = async () => {
  const t = await getTranslations()
  const session = await auth()
  if (!session) {
    return notFound()
  }
  return (
    <div>
      <Header
        homeLinkProps={{
          href: '/bailleur/tableau-de-bord',
          title: t('metadata.workspace.title'),
        }}
        quickAccessItems={[
          <Button
            priority="tertiary no outline"
            key="alerts-cta"
            iconId="ri-notification-3-line"
            linkProps={{ href: '/alerte-logement', target: '_self' }}
          >
            {t('header.notifications')}
          </Button>,
          <Button priority="tertiary" iconId="ri-user-line">
            {session.user.name}
          </Button>,
        ]}
        brandTop={<BrandTop />}
        serviceTagline={t('header.description')}
        serviceTitle={
          <>
            {t('header.title')}
            <span className={fr.cx('fr-ml-1w', 'fr-badge', 'fr-badge--new', 'fr-badge--no-icon')}>ESPACE BAILLEUR</span>
          </>
        }
        navigation={<WorkspaceHeaderNavigation />}
        className={fr.cx('fr-header')}
        operatorLogo={{
          alt: 'Mon logement étudiant - logo',
          imgUrl: logo.src,
          orientation: 'horizontal',
        }}
      />
    </div>
  )
}
