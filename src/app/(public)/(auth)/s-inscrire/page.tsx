import { getTranslations } from 'next-intl/server'
import styles from '../auth.module.css'

import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { SignUpForm } from '~/components/sign-up/sign-up-form'

export default async function SignUpPage() {
  const t = await getTranslations('signUp')
  return (
    <div className={clsx(styles.container, fr.cx('fr-container'))}>
      <Button
        priority="tertiary no outline"
        iconPosition="left"
        iconId="ri-arrow-left-line"
        linkProps={{ href: '/se-connecter' }}
        className={styles.backButton}
      >
        {t('backToLogin')}
      </Button>
      <h1>{t('title')}</h1>
      <p>
        {t('subTitlePart1')}
        &nbsp;<span className={clsx(fr.cx('fr-text--bold'), styles.required)}>*</span>
        &nbsp;{t('subTitlePart2')}
      </p>
      <SignUpForm />
    </div>
  )
}
