import { Header } from '@codegouvfr/react-dsfr/Header'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { FC } from 'react'
import { BrandTop } from '~/components/ui/brand-top'
import { UserConnectedDropdown } from '~/components/ui/header/user-connected-dropdown'
import { WorkspaceHeaderNavigation } from '~/components/ui/header/workspace-navigation'
import { getServerSession } from '~/services/better-auth'

export const WorkspaceHeaderComponent: FC = async () => {
  const t = await getTranslations()
  const auth = await getServerSession()

  if (!auth || !auth.session || !auth.user) {
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
          // <Button
          //   priority="tertiary no outline"
          //   key="alerts-cta"
          //   iconId="ri-notification-3-line"
          //   linkProps={{ href: '/alerte-logement', target: '_self' }}
          // >
          //   {t('header.notifications')}
          // </Button>,
          <UserConnectedDropdown user={auth.user} />,
        ]}
        brandTop={<BrandTop />}
        serviceTagline={t('header.description')}
        serviceTitle={
          <>
            {t('header.title')}
            <span className="fr-ml-1w fr-badge fr-badge--new fr-badge--no-icon fr-text--uppercase">{t('bailleur.header.title')}</span>
          </>
        }
        navigation={<WorkspaceHeaderNavigation />}
        className="fr-header"
      />
    </div>
  )
}
