import { fr } from '@codegouvfr/react-dsfr'
import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import styles from './features.module.css'

export const FeaturesSection = async () => {
  const tHome = await getTranslations('home')

  return (
    <section className={clsx(fr.cx('fr-container'), styles.featuresSection)}>
      <div className={styles.featureCardsGrid}>
        <div className={clsx(styles.featureCard, styles.featureCardPurple)}>
          <Badge severity="new" noIcon className={styles.badgePurple}>
            {tHome('features.simulateAids.badge')}
          </Badge>
          <h2 className={clsx('fr-h2', styles.featureCardTitle)}>{tHome('features.simulateAids.title')}</h2>
          <p className={clsx(fr.cx('fr-text--xl'), styles.featureCardDescription)}>{tHome('features.simulateAids.description')}</p>
          <div className={styles.featureCardButtons}>
            <Button priority="secondary" iconId="ri-money-euro-circle-line" iconPosition="left" linkProps={{ href: '/simuler-mes-aides' }}>
              {tHome('features.simulateAids.button')}
            </Button>
            <div className={styles.featureCardLogos}>
              <Image src="/images/apl.svg" width={23} height={30} alt="APL" />
              <Image src="/images/logo-crous.svg" width={36} height={36} alt="CROUS" />
              <Image src="/images/caf.svg" width={31} height={30} alt="CAF" />
              <Image src="/images/al.svg" width={31} height={32} alt="Action Logement" />
              <Image src="/images/mobilijeune.svg" width={49} height={36} alt="Mobilijeune" />
            </div>
          </div>
        </div>

        <div className={clsx(styles.featureCard, styles.featureCardYellow)}>
          <Badge severity="info" noIcon className={styles.badgeYellow}>
            {tHome('features.calculateBudget.badge')}
          </Badge>
          <h2 className={clsx('fr-h2', styles.featureCardTitle)}>{tHome('features.calculateBudget.title')}</h2>
          <p className={clsx(fr.cx('fr-text--xl'), styles.featureCardDescription)}>{tHome('features.calculateBudget.description')}</p>
          <div className={styles.featureCardButtons}>
            <Button
              priority="secondary"
              iconId="ri-calculator-line"
              iconPosition="left"
              linkProps={{ href: '/preparer-mon-budget-etudiant' }}
            >
              {tHome('features.calculateBudget.button')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
