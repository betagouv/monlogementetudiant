import { Header } from '@codegouvfr/react-dsfr/Header'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { FC } from 'react'
import { BrandTop } from '~/components/ui/brand-top'
import { OwnerSwitcher } from '~/components/ui/header/owner-switcher'
import { UserConnectedDropdown } from '~/components/ui/header/user-connected-dropdown'
import { WorkspaceHeaderNavigation } from '~/components/ui/header/workspace-navigation'
import { getServerSession } from '~/services/better-auth'

export const WorkspaceHeaderComponent: FC = async () => {
  const t = await getTranslations()
  const auth = await getServerSession()

  if (!auth || !auth.session || !auth.user) {
    return notFound()
  }

  const isAdmin = auth.user.role === 'admin'
  const adminOwners = auth.user.adminOwners ?? []
  const showSwitcher = isAdmin && adminOwners.length > 1
  const defaultOwnerId = auth.user.owner?.id ?? adminOwners[0]?.id

  return (
    <div>
      <Header
        homeLinkProps={{
          href: '/bailleur/tableau-de-bord',
          title: t('metadata.workspace.title'),
        }}
        quickAccessItems={[
          ...(showSwitcher ? [<OwnerSwitcher key="owner-switcher" owners={adminOwners} defaultOwnerId={defaultOwnerId} />] : []),
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
        navigation={<WorkspaceHeaderNavigation acceptDossierFacile={auth.user.owner?.acceptDossierFacileApplications ?? false} />}
        className="fr-header"
      />
    </div>
  )
}
