import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import Button from '@codegouvfr/react-dsfr/Button'
import Companie from '@codegouvfr/react-dsfr/picto/Companie'
import { HydrationBoundary } from '@tanstack/react-query'
import { ResidenceFilters } from '~/components/bailleur/residence-filters'
import { ResidenceList } from '~/components/bailleur/residence-list'
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
  const { dehydratedState } = await getResidencesPageContext(awaitedSearchParams)

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="fr-container fr-pb-12w">
        <Breadcrumb
          currentPageLabel={<>Gestion des résidences</>}
          segments={[{ label: 'Tableau de bord', linkProps: { href: '/bailleur/tableau-de-bord' } }]}
          classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
        />

        <div className="fr-flex fr-justify-content-space-between fr-align-items-center">
          <div className="fr-flex fr-justify-content-space-between fr-align-items-center fr-width-full">
            <div className="fr-flex fr-align-items-center fr-flex-gap-4v">
              <Companie width={72} height={72} />
              <h1 className="fr-mb-0">Gestion des résidences</h1>
            </div>
            <div>
              <Button linkProps={{ href: '/bailleur/residences/nouvelle-residence' }} iconId="ri-add-line">
                Nouvelle résidence
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
