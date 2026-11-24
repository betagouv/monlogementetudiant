import Button from '@codegouvfr/react-dsfr/Button'
import { getTranslations } from 'next-intl/server'
import { AlertsLoginRequiredButton } from '~/components/auth/login-required-button'

interface OwnerDetailsAlertProps {
  isAuthenticated: boolean
}

export const OwnerDetailsAlert = async ({ isAuthenticated }: OwnerDetailsAlertProps) => {
  const t = await getTranslations('accomodation.sidebar.alert')

  return (
    <div className="fr-flex fr-direction-column fr-flex-gap-2v fr-align-items-center">
      <span className="fr-text--bold fr-h6 fr-mb-0 fr-text--center">{t('title')}</span>
      <p className="fr-mb-0 fr-text--xs">{t('description')}</p>
      {isAuthenticated ? (
        <Button linkProps={{ href: '/mon-espace/alertes', target: '_self' }} priority="secondary" iconId="ri-mail-line" iconPosition="left">
          {t('cta')}
        </Button>
      ) : (
        <AlertsLoginRequiredButton priority="secondary" iconId="ri-mail-line" iconPosition="left">
          {t('cta')}
        </AlertsLoginRequiredButton>
      )}
    </div>
  )
}
