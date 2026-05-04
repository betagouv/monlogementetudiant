import { fr } from '@codegouvfr/react-dsfr'
import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { Metadata } from 'next'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { SignUpForm } from '~/components/sign-up/sign-up-form'
import background from '~/images/background-credentials.webp'
import styles from '../auth.module.css'

export const generateMetadata = async (): Promise<Metadata> => {
  const [tSignUp, tMeta] = await Promise.all([getTranslations('signUp'), getTranslations('metadata')])
  return { title: tSignUp('title'), description: tMeta('signUp.description') }
}

interface SignUpPageProps {
  searchParams: Promise<{ from?: string }>
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const t = await getTranslations('signUp')
  const { from } = await searchParams
  return (
    <>
      <div className={styles.imageContainer}>
        <Image className={styles.image} src={background} alt="S'inscrire" priority quality={100} />
      </div>
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
        {from === 'alerts' && <Alert severity="info" small description={t('alertsBanner')} className="fr-my-3w" />}
        <h1>{t('title')}</h1>
        <p>
          {t('subTitlePart1')}
          &nbsp;<span className={clsx(fr.cx('fr-text--bold'), styles.required)}>*</span>
          &nbsp;{t('subTitlePart2')}
        </p>
        <SignUpForm />
      </div>
    </>
  )
}
