import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import styles from './owner-details-alert.module.css'

interface OwnerDetailsAlertProps {
  isAuthenticated: boolean
}

export const OwnerDetailsAlert = async ({ isAuthenticated }: OwnerDetailsAlertProps) => {
  const t = await getTranslations('accomodation.sidebar.alert')
  const href = isAuthenticated ? '/mon-espace/alertes' : '/s-inscrire?from=alerts'

  return (
    <div className={styles.container}>
      <span className={clsx(styles.title, 'fr-text--bold fr-h6 fr-mb-0')}>{t('title')}</span>
      <p className="fr-mb-0 fr-text--xs">{t('description')}</p>
      <Button linkProps={{ href, target: '_self' }} priority="primary">
        {t('cta')}
      </Button>
    </div>
  )
}
