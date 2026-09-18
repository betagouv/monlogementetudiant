import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { getFaqContents } from '~/components/faq/faq-content'
import { FaqQuestionsAnswers } from '~/components/faq/faq-questions-answers'
import styles from './faq.module.css'

export const FAQSection = async () => {
  const [tHome, tFaqContents] = await Promise.all([getTranslations('home'), getTranslations('faq.contents')])
  return (
    <section className={clsx('fr-container fr-flex fr-direction-column fr-align-items-center', styles.faqSection)}>
      <h2 className="fr-h1 fr-mb-0">{tHome('faq.title')}</h2>
      <div className={clsx(styles.faqContent, 'fr-border')}>
        <FaqQuestionsAnswers contents={getFaqContents(tFaqContents).slice(0, 5)} />
      </div>
      <Button size="large" priority="secondary" linkProps={{ href: '/foire-aux-questions' }}>
        {tHome('faq.button')}
      </Button>
    </section>
  )
}
