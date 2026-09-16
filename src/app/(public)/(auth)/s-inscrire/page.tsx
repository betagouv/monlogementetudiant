import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { Metadata } from 'next'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { SignUpForm } from '~/components/sign-up/sign-up-form'
import background from '~/images/background-credentials.webp'
import { getClaimedContactRequest } from '~/server/contacts/claimed-request'
import styles from '../auth.module.css'

export const generateMetadata = async (): Promise<Metadata> => {
  const [tSignUp, tMeta] = await Promise.all([getTranslations('signUp'), getTranslations('metadata')])
  return { title: tSignUp('title'), description: tMeta('signUp.description') }
}

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ claim?: string }> }) {
  const t = await getTranslations('signUp')
  // `claim` est remis au visiteur après une demande de contact anonyme : on lui réaffiche ses
  // coordonnées déjà saisies. Le rattachement de la demande au compte, lui, se fera à la
  // vérification de l'e-mail (voir `link-guest-requests.ts`).
  const claimed = await getClaimedContactRequest((await searchParams).claim)
  return (
    <>
      <div className={styles.imageContainer}>
        <Image className={styles.image} src={background} alt={t('imageAlt')} priority quality={100} />
      </div>
      <div className={clsx(styles.container, 'fr-container')}>
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
        <p>{t('requiredFieldsNotice')}</p>
        <SignUpForm prefill={claimed} />
      </div>
    </>
  )
}
