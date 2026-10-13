import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import Button from '@codegouvfr/react-dsfr/Button'
import Companie from '@codegouvfr/react-dsfr/picto/Companie'
import { HydrationBoundary } from '@tanstack/react-query'
import { getTranslations } from 'next-intl/server'
import { ResidenceFilters } from '~/components/bailleur/residence-filters'
import { ResidenceList } from '~/components/bailleur/residence-list'
import { buildHref } from '~/utils/preserve-query-params'
import { getResidencesPageContext } from './get-residences-page-context'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = {
  page?: string
  disponible?: string
  recherche?: string
  ownerId?: string
}

type ResidencesPageProps = {
  searchParams: Promise<SearchParams>
}

export default async function ResidencesPage({ searchParams }: ResidencesPageProps) {
  const awaitedSearchParams = await searchParams
  const [t, { dehydratedState }] = await Promise.all([
    getTranslations('bailleur.residences'),
    getResidencesPageContext(awaitedSearchParams),
  ])

  const newResidenceHref = buildHref('/bailleur/residences/nouvelle-residence', awaitedSearchParams)

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="fr-container fr-pb-12w">
        <Breadcrumb
          currentPageLabel={t('pageTitle')}
          segments={[{ label: t('breadcrumbDashboard'), linkProps: { href: buildHref('/bailleur/tableau-de-bord', awaitedSearchParams) } }]}
          classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
        />

        <div className="fr-flex fr-justify-content-space-between fr-align-items-center">
          <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-width-full">
            <div className="fr-flex fr-align-items-center fr-flex-gap-4v">
              <Companie width={72} height={72} />
              <h1 className="fr-mb-0">{t('pageTitle')}</h1>
            </div>
            <div>
              <Button linkProps={{ href: newResidenceHref }} iconId="ri-add-line">
                {t('newResidence')}
              </Button>
            </div>
          </div>
        </div>
        <hr className="fr-mt-2w fr-mb-0" />
        <ResidenceFilters />
        <ResidenceList />
      </div>
    </HydrationBoundary>
  )
}
