import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { ResetPasswordForm } from '~/components/reset-password/reset-password-form'
import styles from '../auth.module.css'

export default async function ResetPasswordPage() {
  const t = await getTranslations('resetPassword')
  return (
    <div className={clsx(styles.container, fr.cx('fr-container'))}>
      <h1>{t('title')}</h1>
      <ResetPasswordForm />
      <hr className={fr.cx('fr-mt-3w')} />
      <Button priority="secondary" iconPosition="left" iconId="ri-arrow-left-line" linkProps={{ href: '/se-connecter' }}>
        {t('backToLogin')}
      </Button>
    </div>
  )
}
