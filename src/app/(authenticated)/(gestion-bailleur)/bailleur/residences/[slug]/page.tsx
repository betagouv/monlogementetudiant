import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { UpdateResidenceForm } from '~/components/bailleur/details/update-residence-form'
import { getAccommodationMyById } from '~/server/bailleur/get-accommodation-my-by-id'
import { buildHref } from '~/utils/preserve-query-params'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = { ownerId?: string }

export default async function ResidenceDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<SearchParams>
}) {
  const [{ slug }, awaitedSearchParams] = await Promise.all([params, searchParams])
  const accommodation = await getAccommodationMyById(slug)
  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={<>{accommodation.properties.name}</>}
        segments={[
          { label: 'Tableau de bord', linkProps: { href: buildHref('/bailleur/tableau-de-bord', awaitedSearchParams) } },
          { label: 'Gestion des résidences', linkProps: { href: buildHref('/bailleur/residences', awaitedSearchParams) } },
        ]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <UpdateResidenceForm accommodation={accommodation} />
    </div>
  )
}
