import { colors, fr } from '@codegouvfr/react-dsfr'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { HeroSearchBar } from '~/components/home/hero-section/hero-search-bar'
import styles from './hero-section.module.css'

export const HeroSection = async () => {
  const tHome = await getTranslations('home')
  return (
    <section
      className={styles.heroSection}
      style={{
        backgroundColor: colors.decisions.background.alt.blueFrance.default,
      }}
    >
      <div className={styles.heroIllustrationLeft}>
        <Image
          src="/images/hero-illustration-left.svg"
          alt=""
          fill
          style={{ objectFit: 'contain', objectPosition: 'left bottom' }}
          priority
        />
      </div>
      <div className={fr.cx('fr-container')}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            {tHome('hero.title')}
            <br />
            {tHome('hero.titleHighlight')}
          </h1>
          <div className={styles.heroSearchContainer}>
            <HeroSearchBar />
          </div>
          <p className={styles.heroCounter} dangerouslySetInnerHTML={{ __html: tHome.raw('hero.counter') }} />
        </div>
      </div>
      <div className={styles.heroIllustrationRight}>
        <Image
          src="/images/hero-illustration-right.png"
          alt={tHome('hero.illustrationAlt')}
          fill
          style={{ objectFit: 'contain', objectPosition: 'right bottom' }}
          priority
        />
      </div>
    </section>
  )
}
