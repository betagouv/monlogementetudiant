import clsx from 'clsx'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { HeroSearchBar } from '~/components/home/hero-section/hero-search-bar'
import styles from './hero-section.module.css'

export const HeroSection = async () => {
  const tHome = await getTranslations('home')
  return (
    <section className={styles.heroSection}>
      <div className={styles.heroIllustrationLeft}>
        <Image src="/images/hero-illustration-left.svg" alt="" fill className={styles.heroIllustrationLeftImg} priority />
      </div>
      <div className="fr-container">
        <div className={clsx('fr-pt-8w fr-pb-16w', styles.heroContent)}>
          <h1 className={styles.heroTitle}>
            {tHome('hero.title')}
            <br />
            {tHome('hero.titleHighlight')}
          </h1>
          <div className={styles.heroSearchContainer}>
            <HeroSearchBar />
          </div>
          <p className="fr-mb-0 fr-text-default--grey">
            {tHome.rich('hero.counter', {
              strong: (chunks) => <strong className="fr-text-title--grey fr-text--bold">{chunks}</strong>,
            })}
          </p>
        </div>
      </div>
      <div className={styles.heroIllustrationRight}>
        <Image
          src="/images/hero-illustration-right.svg"
          alt={tHome('hero.illustrationAlt')}
          fill
          className={styles.heroIllustrationRightImg}
          priority
        />
      </div>
    </section>
  )
}
