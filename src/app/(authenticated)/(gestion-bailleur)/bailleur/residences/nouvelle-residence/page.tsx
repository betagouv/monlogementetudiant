import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { CreateResidenceForm } from '~/components/bailleur/details/create-residence-form'
import { buildHref } from '~/utils/preserve-query-params'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = { ownerId?: string }

export default async function CreateResidenceDetailsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const awaitedSearchParams = await searchParams
  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel="Nouvelle résidence"
        segments={[
          { label: 'Tableau de bord', linkProps: { href: buildHref('/bailleur/tableau-de-bord', awaitedSearchParams) } },
          { label: 'Gestion des résidences', linkProps: { href: buildHref('/bailleur/residences', awaitedSearchParams) } },
        ]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <CreateResidenceForm />
    </div>
  )
}
