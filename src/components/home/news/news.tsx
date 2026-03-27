import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import styles from './news.module.css'

export const NewsSection = async () => {
  const tHome = await getTranslations('home')
  return (
    <section className={clsx(fr.cx('fr-container'), styles.newsSection)}>
      <h2 className={clsx('fr-h2', styles.sectionTitle)}>{tHome('news.title')}</h2>
      <p className={fr.cx('fr-text--lg', 'fr-mb-4w')}>{tHome('news.description')}</p>
      <div className={styles.newsGrid}>
        <article className={styles.newsCard}>
          <div className={styles.newsCardImage}>
            <Image src="/images/prepare-budget.webp" alt={tHome('news.articles.budget.imageAlt')} fill style={{ objectFit: 'cover' }} />
          </div>
          <div className={styles.newsCardContent}>
            <h3 className="fr-h6">{tHome('news.articles.budget.title')}</h3>
            <p>{tHome('news.articles.budget.description')}</p>
          </div>
        </article>
        <article className={styles.newsCard}>
          <div className={styles.newsCardImage}>
            <Image src="/images/explore-cities.webp" alt={tHome('news.articles.cities.imageAlt')} fill style={{ objectFit: 'cover' }} />
          </div>
          <div className={styles.newsCardContent}>
            <h3 className="fr-h6">{tHome('news.articles.cities.title')}</h3>
            <p>{tHome('news.articles.cities.description')}</p>
          </div>
        </article>
        <article className={styles.newsCard}>
          <div className={styles.newsCardImage}>
            <Image src="/images/background.webp" alt={tHome('news.articles.aids.imageAlt')} fill style={{ objectFit: 'cover' }} />
          </div>
          <div className={styles.newsCardContent}>
            <h3 className="fr-h6">{tHome('news.articles.aids.title')}</h3>
            <p>{tHome('news.articles.aids.description')}</p>
          </div>
        </article>
      </div>
      <div className={clsx(fr.cx('fr-mt-4w'), 'fr-flex fr-justify-content-center')}>
        <Button priority="secondary" linkProps={{ href: '/actualites' }} iconPosition="right" iconId="ri-arrow-right-line">
          {tHome('news.moreButton')}
        </Button>
      </div>
    </section>
  )
}
