import { fr } from '@codegouvfr/react-dsfr'
import clsx from 'clsx'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { MagicLinkSignInForm } from '~/components/magic-link-sign-in/magic-link-sign-in'
import background from '~/images/background-owner.webp'
import authStyles from '../../auth.module.css'

export const metadata = {
  title: 'Connexion Administration - Mon Logement Etudiant',
  robots: { index: false, follow: false },
}

export default async function AdminLoginPage() {
  const t = await getTranslations('login')
  return (
    <>
      <div className={authStyles.imageContainer}>
        <Image className={authStyles.image} src={background} alt="Se connecter" priority quality={100} />
      </div>
      <div className={clsx(authStyles.container, fr.cx('fr-container'))}>
        <h1>Se connecter à l'Espace Administration</h1>
        <p>
          {t('subTitlePart1')}
          &nbsp;<span className={clsx(fr.cx('fr-text--bold'), authStyles.required)}>*</span>
          &nbsp;{t('subTitlePart2')}
        </p>
        <MagicLinkSignInForm callbackURL="/administration/tableau-de-bord" type="admin" />
      </div>
    </>
  )
}
