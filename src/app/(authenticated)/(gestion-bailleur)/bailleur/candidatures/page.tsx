import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { Avatar } from '@codegouvfr/react-dsfr/picto'
import { HydrationBoundary } from '@tanstack/react-query'
import { CandidaturesList } from '~/components/bailleur/candidatures/candidatures-list'
import { getCandidaturesPageContext } from './get-candidatures-page-context'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = {
  page?: string
  status?: string
  recherche?: string
  tri?: string
}

type CandidaturesPageProps = {
  searchParams: Promise<SearchParams>
}

export default async function CandidaturesPage({ searchParams }: CandidaturesPageProps) {
  const awaitedSearchParams = await searchParams
  const { dehydratedState } = await getCandidaturesPageContext(awaitedSearchParams)

  return (
    <HydrationBoundary state={dehydratedState}>
      <div className="fr-container fr-pb-12w">
        <Breadcrumb
          currentPageLabel={<>Gestion des candidatures</>}
          segments={[{ label: 'Tableau de bord', linkProps: { href: '/bailleur/tableau-de-bord' } }]}
          classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
        />

        <div className="fr-flex fr-align-items-center fr-flex-gap-4v">
          <Avatar width={72} height={72} />
          <h1 className="fr-mb-0">Gestion des candidatures</h1>
        </div>
        <hr className="fr-mt-2w fr-mb-0" />

        <CandidaturesList />
      </div>
    </HydrationBoundary>
  )
}
