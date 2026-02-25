import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import DocumentSearch from '@codegouvfr/react-dsfr/picto/DocumentSearch'
import { ContactTeamButton } from '~/components/bailleur/contact-team-button'
import { FaqQuestionsAnswers } from '~/components/faq/faq-questions-answers'

export default async function CentreDAidePage() {
  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={<>Centre d'aide</>}
        segments={[{ label: 'Tableau de bord', linkProps: { href: '/bailleur/tableau-de-bord' } }]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <div className="fr-flex fr-justify-content-space-between fr-align-items-center">
        <div className="fr-flex fr-align-items-center fr-flex-gap-4v">
          <DocumentSearch width={62} height={66} />
          <h1 className="fr-mb-0">Centre d'aide</h1>
        </div>
        <ContactTeamButton />
      </div>
      <div className="fr-mt-2w">
        <FaqQuestionsAnswers />
      </div>
    </div>
  )
}
