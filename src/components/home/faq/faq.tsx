import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { FAQ_CONTENTS } from '~/components/faq/faq-content'
import { FaqQuestionsAnswers } from '~/components/faq/faq-questions-answers'
import styles from './faq.module.css'

export const FAQSection = async () => {
  const tHome = await getTranslations('home')
  return (
    <section className={clsx('fr-container fr-flex fr-direction-column fr-align-items-center', styles.faqSection)}>
      <h2 className="fr-h1 fr-mb-0">{tHome('faq.title')}</h2>
      <div className={clsx(styles.faqContent, 'fr-border')}>
        <FaqQuestionsAnswers contents={FAQ_CONTENTS.slice(0, 5)} />
      </div>
      <Button size="large" priority="secondary" linkProps={{ href: '/foire-aux-questions' }}>
        {tHome('faq.button')}
      </Button>
    </section>
  )
}
