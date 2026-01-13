import { fr } from '@codegouvfr/react-dsfr'
import Accordion from '@codegouvfr/react-dsfr/Accordion'
import Button from '@codegouvfr/react-dsfr/Button'
import { clsx } from 'clsx'
import { WrapperSimulator } from '~/app/(public)/simuler-mes-aides-au-logement/wrapper-simulator'
import { getGlobalQuestionsAnswers } from '~/server-only/get-global-questions-answers'
import styles from './simuler-mes-aides-au-logement.module.css'

export default async function SimulateAccommodationAids() {
  const qa = await getGlobalQuestionsAnswers()
  return (
    <>
      <WrapperSimulator />

      <div className={clsx('primaryBackgroundColor', styles.faqSection)}>
        <div className={fr.cx('fr-container')}>
          <div className={clsx('fr-col-md-12', styles.faqContainer)}>
            <div className={clsx(fr.cx('fr-col-md-4'), styles.faqTitleContainer)}>
              <h2 className={styles.faqTitle}>
                Parmi les questions fréquentes sur les <br />
                aides aux logements étudiants
              </h2>
              <div className={styles.faqButtonContainer}>
                <Button iconId="ri-question-line" className="whiteButton" priority="secondary" linkProps={{ href: '/foire-aux-questions' }}>
                  Foire aux questions
                </Button>
              </div>
            </div>
            <div className={fr.cx('fr-col-md-8')}>
              <div className={clsx(fr.cx('fr-accordions-group'), styles.faqContent)}>
                {qa.map((qa, index) => (
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
