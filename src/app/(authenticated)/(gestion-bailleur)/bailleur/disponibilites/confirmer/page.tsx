import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { getTranslations } from 'next-intl/server'
import { ConfirmAvailability } from '~/components/bailleur/confirm-availability'

export const dynamic = 'force-dynamic'

export const generateMetadata = async () => {
  const t = await getTranslations('bailleur.confirmAvailability')
  return { title: t('pageTitle') }
}

export default async function ConfirmAvailabilityPage() {
  const t = await getTranslations('bailleur.confirmAvailability')

  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={t('pageTitle')}
        segments={[{ label: t('breadcrumbDashboard'), linkProps: { href: '/bailleur/tableau-de-bord' } }]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <h1>{t('pageTitle')}</h1>
      <ConfirmAvailability />
    </div>
  )
}
