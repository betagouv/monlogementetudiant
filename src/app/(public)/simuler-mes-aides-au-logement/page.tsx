import Accordion from '@codegouvfr/react-dsfr/Accordion'
import Button from '@codegouvfr/react-dsfr/Button'
import { clsx } from 'clsx'
import { getTranslations } from 'next-intl/server'
import { WrapperSimulator } from '~/app/(public)/simuler-mes-aides-au-logement/wrapper-simulator'
import { getGlobalQuestionsAnswers } from '~/server/questions-answers/get-global-questions-answers'
import { getCanonicalUrl, getDefaultOgImage } from '~/utils/canonical'
import styles from './simuler-mes-aides-au-logement.module.css'

export const generateMetadata = async () => {
  const t = await getTranslations('metadata')
  return {
    title: t('simulateAids.title'),
    description: t('simulateAids.description'),
    alternates: { canonical: getCanonicalUrl('/simuler-mes-aides-au-logement') },
    openGraph: {
      title: t('simulateAids.title'),
      description: t('simulateAids.description'),
      siteName: 'Mon Logement Étudiant',
      locale: 'fr_FR',
      type: 'website',
      images: getDefaultOgImage(),
    },
    twitter: {
      card: 'summary_large_image' as const,
    },
  }
}

export default async function SimulateAccommodationAids() {
  const [questionsAnswers, t, tFaq] = await Promise.all([
    getGlobalQuestionsAnswers(),
    getTranslations('simulator.faq'),
    getTranslations('faq'),
  ])
  return (
    <>
      <WrapperSimulator />

      <div className={clsx('primaryBackgroundColor', styles.faqSection)}>
        <div className="fr-container">
          <div className={clsx('fr-col-md-12', styles.faqContainer)}>
            <div className={clsx('fr-col-md-4', styles.faqTitleContainer)}>
              <h2 className={styles.faqTitle}>{t.rich('title', { br: () => <br /> })}</h2>
              <div className={styles.faqButtonContainer}>
                <Button iconId="ri-question-line" className="whiteButton" priority="secondary" linkProps={{ href: '/foire-aux-questions' }}>
                  {tFaq('title')}
                </Button>
              </div>
            </div>
            <div className="fr-col-md-8">
              <div className={clsx('fr-accordions-group', styles.faqContent)}>
                {questionsAnswers.map((qa, index) => (
                  <Accordion key={index} label={qa.title_fr}>
                    <div dangerouslySetInnerHTML={{ __html: qa.content_fr }} />
                  </Accordion>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
