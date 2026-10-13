import Button from '@codegouvfr/react-dsfr/Button'
import { Money } from '@codegouvfr/react-dsfr/picto'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import styles from './prepare-budget-simulate-aids-card.module.css'

export default async function PrepareBudgetSimulateAidsCard() {
  const [t, tAids] = await Promise.all([
    getTranslations('prepareBudget.content.item1.simulationCard'),
    getTranslations('prepareStudentLife.stats.aids'),
  ])
  const locationAids = [tAids('national'), tAids('regional'), tAids('departmental'), tAids('city')]

  return (
    <div className={clsx('fr-col-md-5', 'fr-ml-md-2w', 'fr-px-2w', 'fr-py-4w', styles.container)}>
      <Money width={80} height={80} />
      <span className="fr-mb-0 fr-text--bold">{t('title')}</span>
      <div>
        {locationAids.map((aid) => (
          <div key={aid}>
            <span className={clsx(styles.icon, 'ri-check-line')} aria-hidden="true" />
            {aid}
          </div>
        ))}
      </div>
      <Button linkProps={{ href: '/simuler-mes-aides-au-logement' }} iconId="ri-money-euro-circle-line">
        {t('cta')}
      </Button>
    </div>
  )
}
