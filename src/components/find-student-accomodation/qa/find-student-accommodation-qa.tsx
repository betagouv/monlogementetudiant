import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { FAQ_CONTENTS } from '~/app/(public)/(utils-pages)/faq/page'
import { FaqQuestionsAnswers } from '~/components/faq/faq-questions-answers'
import styles from './find-student-accommodation-qa.module.css'

// type FindStudentAccommodationQAProps = {
//   qa: TGetQuestionsAnswersResponse
// }
export default async function FindStudentAccommodationQA() {
  const t = await getTranslations('findAccomodation')

  return (
    <div className={clsx(styles.mainQaFaqContainer, 'primaryBackgroundColor')}>
      <div className={fr.cx('fr-container')}>
        <div className={styles.faqQaContainer}>
          <div className={styles.faqTitleCtaContainer}>
            <h2 className={clsx(styles.whiteColor, styles.titleMargin)}>{t('faq.title')}</h2>
            <Button iconId="ri-question-line" linkProps={{ href: '/faq', target: '_self' }} className="whiteButton" priority="secondary">
              {t('faq.cta')}
            </Button>
          </div>
          <div className={styles.qaContainer}>
            <FaqQuestionsAnswers contents={FAQ_CONTENTS.slice(0, 3)} />
          </div>
        </div>
      </div>
    </div>
  )
}
