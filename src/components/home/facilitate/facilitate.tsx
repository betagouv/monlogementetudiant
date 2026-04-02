import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import styles from './facilitate.module.css'

export const FacilitateSection = async () => {
  const tHome = await getTranslations('home')
  return (
    <section className={styles.facilitateSection}>
      <div className={fr.cx('fr-container')}>
        <div className={styles.facilitateSectionContent}>
          <div className={styles.faciliteSectionContentLeft}>
            <div>
              <h2 className={clsx('fr-h2', styles.facilitateTitle)}>{tHome('facilitate.title')}</h2>
              <h2 className={clsx('fr-h2', styles.highlight)}>{tHome('facilitate.titleHighlight')}</h2>
            </div>
            <Image src="/images/facilities.svg" alt={tHome('hero.illustrationAlt')} width={150} height={150} />
          </div>
          <div className={styles.facilitateContent}>
            <ul className={styles.facilitateList}>
              <li className={styles.facilitateItem}>
                <div className={styles.facilitateItemBefore}>
                  <div>
                    <i className={clsx('ri-hotel-line', styles.facilitateIcon)} aria-hidden="true" />
                  </div>
                  <div></div>
                </div>
                <div>
                  <span>{tHome('facilitate.items.offers')}</span>
                  <br />
                  <span>{tHome('facilitate.items.offersDescription')}</span>
                </div>
              </li>
              <li className={styles.facilitateItem}>
                <div className={styles.facilitateItemBefore}>
                  <div>
                    <i className={clsx('ri-money-euro-circle-line', styles.facilitateIcon)} aria-hidden="true" />
                  </div>
                  <div></div>
                </div>
                <div>
                  <span>{tHome('facilitate.items.simulator')}</span>
                  <br />
                  <span>{tHome('facilitate.items.simulatorDescription')}</span>
                </div>
              </li>
              <li className={styles.facilitateItem}>
                <div className={styles.facilitateItemBefore}>
                  <div>
                    <i className={clsx('ri-calculator-line', styles.facilitateIcon)} aria-hidden="true" />
                  </div>
                  <div></div>
                </div>
                <div>
                  <span>{tHome('facilitate.items.calculator')}</span>
                  <br />
                  <span>{tHome('facilitate.items.calculatorDescription')}</span>
                </div>
              </li>
              <li className={styles.facilitateItem}>
                <div className={styles.facilitateItemBefore}>
                  <div>
                    <i className={clsx('ri-mail-unread-line', styles.facilitateIcon)} aria-hidden="true" />
                  </div>
                  <div></div>
                </div>
                <div>
                  <span>{tHome('facilitate.items.alerts')}</span>
                  <br />
                  <span>{tHome('facilitate.items.alertsDescription')}</span>
                </div>
              </li>
              <li className={styles.facilitateItem}>
                <div className={styles.facilitateItemBefore}>
                  <div>
                    <i className={clsx('ri-user-line', styles.facilitateIcon)} aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <span>{tHome('facilitate.items.account')}</span>
                  <br />
                  <span>{tHome('facilitate.items.accountDescription')}</span>
                </div>
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
