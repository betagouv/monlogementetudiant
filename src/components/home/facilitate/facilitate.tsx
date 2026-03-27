import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import styles from './facilitate.module.css'

export const FacilitateSection = async () => {
  const tHome = await getTranslations('home')
  return (
    <section className={styles.facilitateSection}>
      <div className={fr.cx('fr-container')}>
        <div className={styles.facilitateSectionContent}>
          <div className={styles.facilitateIllustration} />
          <div className={styles.facilitateContent}>
            <h2 className={clsx('fr-h2', styles.facilitateTitle)}>{tHome('facilitate.title')}</h2>
            <ul className={styles.facilitateList}>
              <li className={styles.facilitateItem}>
                <span className={fr.cx('ri-home-line', 'fr-mr-2w')} aria-hidden="true" />
                {tHome('facilitate.items.offers')}
              </li>
              <li className={styles.facilitateItem}>
                <span className={fr.cx('ri-calculator-line', 'fr-mr-2w')} aria-hidden="true" />
                {tHome('facilitate.items.simulator')}
              </li>
              <li className={styles.facilitateItem}>
                <span className={fr.cx('ri-money-euro-circle-line', 'fr-mr-2w')} aria-hidden="true" />
                {tHome('facilitate.items.calculator')}
              </li>
              <li className={styles.facilitateItem}>
                <span className={fr.cx('ri-notification-line', 'fr-mr-2w')} aria-hidden="true" />
                {tHome('facilitate.items.alerts')}
              </li>
              <li className={styles.facilitateItem}>
                <span className={fr.cx('ri-user-line', 'fr-mr-2w')} aria-hidden="true" />
                {tHome('facilitate.items.account')}
              </li>
            </ul>
            <Button className={styles.facilitateButton} linkProps={{ href: '/inscription' }}>
              {tHome('facilitate.button')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
