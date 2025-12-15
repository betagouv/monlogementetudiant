import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import Button from '@codegouvfr/react-dsfr/Button'
import DocumentSearch from '@codegouvfr/react-dsfr/picto/DocumentSearch'
import { FaqQuestionsAnswers } from '~/components/faq/faq-questions-answers'

export default async function CentreDAidePage() {
  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={<>Centre d'aide</>}
        segments={[{ label: 'Tableau de bord', linkProps: { href: '/bailleur/tableau-de-bord' } }]}
        className="fr-mt-0 fr-pt-2w"
        classes={{ root: 'fr-mb-0' }}
      />
      <div className="fr-flex fr-justify-content-space-between fr-align-items-center">
        <div className="fr-flex fr-align-items-center fr-flex-gap-4v">
          <DocumentSearch width={62} height={66} />
          <h1 className="fr-mb-0">Centre d'aide</h1>
        </div>
        <Button iconId="ri-search-line" priority="secondary" linkProps={{ href: 'mailto:contact@monlogementetudiant.beta.gouv.fr' }}>
          Contacter l'équipe
        </Button>
      </div>
      <div className="fr-mt-2w">
        <FaqQuestionsAnswers />
      </div>
    </div>
  )
}
