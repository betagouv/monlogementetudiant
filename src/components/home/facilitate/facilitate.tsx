import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import styles from './facilitate.module.css'

const ITEMS = [
  { icon: 'ri-hotel-line', titleKey: 'facilitate.items.offers', descKey: 'facilitate.items.offersDescription', showLine: true },
  {
    icon: 'ri-money-euro-circle-line',
    titleKey: 'facilitate.items.simulator',
    descKey: 'facilitate.items.simulatorDescription',
    showLine: true,
  },
  {
    icon: 'ri-calculator-line',
    titleKey: 'facilitate.items.calculator',
    descKey: 'facilitate.items.calculatorDescription',
    showLine: true,
  },
  { icon: 'ri-mail-unread-line', titleKey: 'facilitate.items.alerts', descKey: 'facilitate.items.alertsDescription', showLine: true },
  { icon: 'ri-user-line', titleKey: 'facilitate.items.account', descKey: 'facilitate.items.accountDescription', showLine: false },
] as const

export const FacilitateSection = async () => {
  const tHome = await getTranslations('home')
  return (
    <section className={clsx('fr-py-8w', styles.facilitateSection)}>
      <div className="fr-container">
        <h2 className={clsx('fr-h1', styles.facilitateTitle)}>
          {tHome('facilitate.title')}
          <br />
          <span className={styles.highlight}>{tHome('facilitate.titleHighlight')}</span>
        </h2>
        <div className="fr-flex fr-direction-column fr-direction-md-row fr-align-items-center fr-flex-gap-8v">
          <div className={styles.faciliteSectionContentLeft}>
            <Image
              className={styles.facilitateIllustration}
              src="/images/facilities.svg"
              alt={tHome('hero.illustrationAlt')}
              width={610}
              height={587}
            />
          </div>
          <div className="fr-flex fr-direction-column fr-flex-gap-6v">
            <ul className={clsx('fr-flex fr-direction-column fr-flex-gap-4v', styles.facilitateList)}>
              {ITEMS.map((item) => (
                <li key={item.titleKey} className={styles.facilitateItem}>
                  <div className={styles.facilitateItemBefore}>
                    <div>
                      <i className={clsx(item.icon, styles.facilitateIcon)} aria-hidden="true" />
                    </div>
                    {item.showLine && <div className={styles.facilitateItemLine} />}
                  </div>
                  <div>
                    <span className={styles.facilitateItemTitle}>{tHome(item.titleKey)}</span>
                    <br />
                    <span className={styles.facilitateItemDescription}>{tHome(item.descKey)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <Button className={styles.facilitateButton} linkProps={{ href: '/s-inscrire' }}>
              {tHome('facilitate.button')}
            </Button>
          </div>
          <Image
            className={styles.facilitateIllustrationMobile}
            src="/images/facilities.svg"
            alt={tHome('hero.illustrationAlt')}
            width={352}
            height={215}
          />
        </div>
      </div>
    </section>
  )
}
