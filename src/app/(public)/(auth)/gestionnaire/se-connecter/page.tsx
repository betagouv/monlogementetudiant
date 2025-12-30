import { fr } from '@codegouvfr/react-dsfr'
import clsx from 'clsx'
import { getTranslations } from 'next-intl/server'
import { MagicLinkSignInForm } from '~/components/magic-link-sign-in/magic-link-sign-in'
import authStyles from '../../auth.module.css'

export default async function LoginPage() {
  const t = await getTranslations('login')
  return (
    <div className={clsx(authStyles.container, fr.cx('fr-container'))}>
      <h1>{t('title')}</h1>
      <p>
        {t('subTitlePart1')}
        &nbsp;<span className={clsx(fr.cx('fr-text--bold'), authStyles.required)}>*</span>
        &nbsp;{t('subTitlePart2')}
      </p>
      <MagicLinkSignInForm />
    </div>
  )
}
