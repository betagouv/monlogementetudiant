import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { getFaqContents } from '~/components/faq/faq-content'
import { FaqQuestionsAnswers } from '~/components/faq/faq-questions-answers'
import styles from './find-student-accommodation-qa.module.css'

export default async function FindStudentAccommodationQA() {
  const [t, tFaqContents] = await Promise.all([getTranslations('findAccomodation'), getTranslations('faq.contents')])

  return (
    <div className={clsx(styles.mainQaFaqContainer, 'primaryBackgroundColor')}>
      <div className="fr-container">
        <div className={styles.faqQaContainer}>
          <div className={styles.faqTitleCtaContainer}>
            <h2 className={clsx(styles.whiteColor, styles.titleMargin)}>{t('faq.title')}</h2>
            <Button
              iconId="ri-question-line"
              linkProps={{ href: '/foire-aux-questions', target: '_self' }}
              className="whiteButton"
              priority="secondary"
            >
              {t('faq.cta')}
            </Button>
          </div>
          <div className={styles.qaContainer}>
            <FaqQuestionsAnswers contents={getFaqContents(tFaqContents).slice(0, 3)} />
          </div>
        </div>
      </div>
    </div>
  )
}
