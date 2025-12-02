import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { ForgotPasswordForm } from '~/components/forgot-password/forgot-password-form'
import styles from '../auth.module.css'

export default async function ForgotPasswordPage() {
  const t = await getTranslations('forgotPassword')
  return (
    <div className={clsx(styles.container, fr.cx('fr-container'))}>
      <h1>{t('title')}</h1>
      <p>
        {t('subTitlePart1')}
        &nbsp;<span className={clsx(fr.cx('fr-text--bold'), styles.required)}>*</span>
        &nbsp;{t('subTitlePart2')}
      </p>
      <ForgotPasswordForm />
      <hr className={fr.cx('fr-mt-3w')} />
      <Button priority="secondary" iconPosition="left" iconId="ri-arrow-left-line" linkProps={{ href: '/se-connecter' }}>
        {t('backToLogin')}
      </Button>
    </div>
  )
}
