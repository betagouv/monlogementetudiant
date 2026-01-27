import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { CreateResidenceForm } from '~/components/bailleur/details/create-residence-form'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CreateResidenceDetailsPage() {
  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel="Nouvelle résidence"
        segments={[
          { label: 'Tableau de bord', linkProps: { href: '/bailleur/tableau-de-bord' } },
          { label: 'Gestion des résidences', linkProps: { href: '/bailleur/residences' } },
        ]}
        className="fr-mt-0 fr-pt-2w"
        classes={{ root: 'fr-mb-2w' }}
      />
      <CreateResidenceForm />
    </div>
  )
}
