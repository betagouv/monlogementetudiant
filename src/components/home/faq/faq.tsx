import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { FAQ_CONTENTS } from '~/components/faq/faq-content'
import { FaqQuestionsAnswers } from '~/components/faq/faq-questions-answers'
import styles from './faq.module.css'

export const FAQSection = async () => {
  const tHome = await getTranslations('home')
  return (
    <section className={clsx(fr.cx('fr-container'), styles.faqSection)}>
      <h2 className={clsx('fr-h2', styles.sectionTitle)}>{tHome('faq.title')}</h2>
      <div className={styles.faqContent}>
        <FaqQuestionsAnswers contents={FAQ_CONTENTS.slice(0, 5)} />
      </div>
      <Button size="large" priority="secondary" linkProps={{ href: '/foire-aux-questions' }}>
        {tHome('faq.button')}
      </Button>
    </section>
  )
}
