import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import DocumentSearch from '@codegouvfr/react-dsfr/picto/DocumentSearch'
import { getTranslations } from 'next-intl/server'
import { ContactTeamButton } from '~/components/bailleur/contact-team-button'
import { FaqQuestionsAnswers } from '~/components/faq/faq-questions-answers'
import { getWordpressFaqArticles } from '~/server/services/wordpress-faq'
import { buildHref } from '~/utils/preserve-query-params'

type SearchParams = { ownerId?: string }

export default async function CentreDAidePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const awaitedSearchParams = await searchParams
  const [t, faqArticles] = await Promise.all([getTranslations('bailleur.helpCenter'), getWordpressFaqArticles()])
  return (
    <div className="fr-container fr-pb-12w">
      <Breadcrumb
        currentPageLabel={t('title')}
        segments={[{ label: t('breadcrumbDashboard'), linkProps: { href: buildHref('/bailleur/tableau-de-bord', awaitedSearchParams) } }]}
        classes={{ root: 'fr-mt-0 fr-mb-2w fr-pt-4w' }}
      />
      <div className="fr-flex fr-justify-content-space-between fr-align-items-center">
        <div className="fr-flex fr-align-items-center fr-flex-gap-4v">
          <DocumentSearch width={62} height={66} />
          <h1 className="fr-mb-0">{t('title')}</h1>
        </div>
        <ContactTeamButton />
      </div>
      <div className="fr-mt-2w">
        <FaqQuestionsAnswers contents={faqArticles} />
      </div>
    </div>
  )
}
