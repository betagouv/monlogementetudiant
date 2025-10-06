import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { LoginForm } from '~/components/login/login-form'
import authStyles from '../auth.module.css'
import styles from './login.module.css'

export default async function LoginPage() {
  const t = await getTranslations('login')
  return (
    <div className={clsx(authStyles.container, fr.cx('fr-container'))}>
      <h1>{t('title')}</h1>
      <p>
        {t('subTitlePart1')}
        &nbsp;<span className={clsx(fr.cx('fr-text--bold'), styles.required)}>*</span>
        &nbsp;{t('subTitlePart2')}
      </p>
      <LoginForm />
      <div className={styles.dividerContainer}>
        <span className={styles.divider}>{t('labels.or')}</span>
      </div>
      <div className={styles.firstVisitContainer}>
        <h2>{t('firstVisit.title')}</h2>
        <p>{t('firstVisit.description')}</p>
        <Button priority="secondary" iconPosition="left" iconId="ri-user-line" linkProps={{ href: '/s-inscrire' }}>
          {t('firstVisit.cta')}
        </Button>
      </div>
    </div>
  )
}
