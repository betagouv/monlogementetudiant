import { fr } from '@codegouvfr/react-dsfr'
import { Header } from '@codegouvfr/react-dsfr/Header'
import { getTranslations } from 'next-intl/server'
import { FC } from 'react'
import { BrandTop } from '~/components/ui/brand-top'
import { UserConnectedDropdown } from '~/components/ui/header/user-connected-dropdown'
import { getServerSession } from '~/services/better-auth'

export const AdminHeaderComponent: FC = async () => {
  const t = await getTranslations()
  const auth = await getServerSession()

  if (!auth || !auth.session || !auth.user) {
    return null
  }

  return (
    <div>
      <Header
        homeLinkProps={{
          href: '/administration/tableau-de-bord',
          title: 'Administration - Mon Logement Etudiant',
        }}
        quickAccessItems={[<UserConnectedDropdown key="user-dropdown" user={auth.user} />]}
        brandTop={<BrandTop />}
        serviceTagline={t('header.description')}
        serviceTitle={
          <>
            {t('header.title')}
            <span className="fr-ml-1w fr-badge fr-badge--error fr-badge--no-icon fr-text--uppercase">Administration</span>
          </>
        }
        className={fr.cx('fr-header')}
      />
    </div>
  )
}
