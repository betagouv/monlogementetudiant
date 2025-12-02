import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import { Money } from '@codegouvfr/react-dsfr/picto'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import styles from './prepare-budget-simulate-aids-card.module.css'

export default async function PrepareBudgetSimulateAidsCard() {
  const t = await getTranslations('prepareBudget.content.item1.simulationCard')
  const locationAids = ['Aides nationales', 'Aides régionales', 'Aides départementales', 'Aides de la ville']

  return (
    <div className={clsx(fr.cx('fr-col-md-5', 'fr-ml-md-2w', 'fr-px-2w', 'fr-py-4w'), styles.container)}>
      <Money width={80} height={80} />
      <span className={fr.cx('fr-mb-0', 'fr-text--bold')}>{t('title')}</span>
      <div>
        {locationAids.map((aid) => (
          <div key={aid}>
            <i className={clsx(styles.icon, 'ri-check-line')}></i>
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
