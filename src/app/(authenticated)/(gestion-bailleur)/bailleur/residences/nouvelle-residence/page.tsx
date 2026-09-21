import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { getTranslations } from 'next-intl/server'
import { CreateResidenceForm } from '~/components/bailleur/details/create-residence-form'
import { buildHref } from '~/utils/preserve-query-params'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = { ownerId?: string }

export default async function CreateResidenceDetailsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [awaitedSearchParams, t] = await Promise.all([searchParams, getTranslations('bailleur.residences')])
  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={t('newResidence')}
        segments={[
          { label: t('breadcrumbDashboard'), linkProps: { href: buildHref('/bailleur/tableau-de-bord', awaitedSearchParams) } },
          { label: t('pageTitle'), linkProps: { href: buildHref('/bailleur/residences', awaitedSearchParams) } },
        ]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <CreateResidenceForm />
    </div>
  )
}
