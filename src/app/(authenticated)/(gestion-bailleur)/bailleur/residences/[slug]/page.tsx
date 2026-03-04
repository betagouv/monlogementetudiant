import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { UpdateResidenceForm } from '~/components/bailleur/details/update-residence-form'
import { getAccommodationMyById } from '~/server/bailleur/get-accommodation-my-by-id'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ResidenceDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const accommodation = await getAccommodationMyById(slug)
  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={<>{accommodation.properties.name}</>}
        segments={[
          { label: 'Tableau de bord', linkProps: { href: '/bailleur/tableau-de-bord' } },
          { label: 'Gestion des résidences', linkProps: { href: '/bailleur/residences' } },
        ]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <UpdateResidenceForm accommodation={accommodation} />
    </div>
  )
}
