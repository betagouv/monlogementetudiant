import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import { Companie } from '@codegouvfr/react-dsfr/picto'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import styles from './prepare-budget-redirection-card.module.css'

export default async function PrepareBudgetRedirectionCard() {
  const t = await getTranslations('prepareBudget.content.redirectionCard')
  return (
    <div className={styles.container}>
      <Companie width={80} height={80} />
      <h3 className={fr.cx('fr-mb-0')}>{t('title')}</h3>
      <p className={fr.cx('fr-mb-0')}>{t('description')}</p>
      <Button linkProps={{ href: '/trouver-un-logement-etudiant' }} size="large">
        {t('cta')}
      </Button>
      <p className={clsx(fr.cx('fr-mb-0'), styles.ctaDisclaimer)}>{t('ctaDisclaimer')}</p>
    </div>
  )
}
