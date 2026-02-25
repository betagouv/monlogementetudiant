'use client'

import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb'
import clsx from 'clsx'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { FC, useMemo, useState } from 'react'
import { HelpSimulator } from '~/components/helps-simulator/help-simulator'
import homeHero from '~/images/home-bg.webp'
import styles from './simuler-mes-aides-au-logement.module.css'

const WrapperHeaderSimulator: FC = () => {
  const t = useTranslations('simulator')
  const breadcrumbT = useTranslations('breadcrumbs')
  return (
    <div className={clsx('fr-container', styles.heroSection)}>
      <Breadcrumb
        currentPageLabel={breadcrumbT('home')}
        homeLinkProps={{ href: '/', className: 'fr-text-inverted--grey' }}
        segments={[]}
        classes={{ link: 'fr-text-inverted--grey', root: 'fr-mt-0 fr-mb-2w fr-pt-4w breadcrumbInverted' }}
      />
      <div className={clsx('fr-col-md-4', styles.heroContent)}>
        <h1 className={styles.heroTitle}>
          {t('titlePart1')} <span className={styles.heroHighlight}>{t('titlePart2')}&nbsp;</span>
          <span className={styles.heroHighlight}>{t('titlePart3')}</span>
        </h1>
        <p className={styles.heroDescription}>
          {t('descriptionPart1')} <br /> {t('descriptionPart2')}
        </p>
      </div>
    </div>
  )
}

export const WrapperSimulator: FC = () => {
  const [simulatorHeight, setSimulatorHeight] = useState<number>(0)
  const computedHeight = useMemo(() => {
    return `${simulatorHeight}px`
  }, [simulatorHeight])

  const containerStyles = { height: computedHeight, minHeight: computedHeight }

  return (
    <div className="fr-position-relative">
      <div style={containerStyles} className="primaryBackgroundColor fr-hidden fr-unhidden-md">
        <WrapperHeaderSimulator />
      </div>
      <div className="primaryBackgroundColor fr-hidden-sm">
        <WrapperHeaderSimulator />
      </div>

      <div className={clsx(styles.imageWrapper, 'fr-hidden fr-unhidden-md')}>
        <Image src={homeHero} priority alt="Image de la page d'accueil" quality={100} className={styles.heroImage} />
      </div>
      <div className={clsx('fr-container', styles.formContainer)}>
        <div className={clsx('fr-col-md-8', styles.formContent)}>
          <HelpSimulator onHeightChange={setSimulatorHeight} />
        </div>
      </div>
      <div className={clsx(styles.imageWrapper, 'fr-hidden-sm')}>
        <Image src={homeHero} priority alt="Image de la page d'accueil" quality={100} className={styles.heroImage} />
      </div>
    </div>
  )
}
