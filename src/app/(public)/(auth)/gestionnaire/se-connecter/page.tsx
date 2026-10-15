import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { Metadata } from 'next'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { SignInMethodSwitcher } from '~/components/otp-sign-in/otp-sign-in'
import background from '~/images/connexion.svg'
import { env } from '~/server/env'
import { safeCallbackPath } from '~/utils/safe-callback-path'
import authStyles from '../../auth.module.css'

export const generateMetadata = async (): Promise<Metadata> => {
  const [tLogin, tMeta] = await Promise.all([getTranslations('login'), getTranslations('metadata')])
  return { title: tLogin('ownerTitle'), description: tMeta('loginOwner.description') }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams
  const t = await getTranslations('login')
  const tA11y = await getTranslations('accessibility')
  const calendlyUrl = z.string().parse(env.NEXT_PUBLIC_CALENDLY_URL)
  return (
    <>
      <div className={authStyles.imageContainer}>
        <Image className={authStyles.image} src={background} alt={t('labels.cta')} priority quality={100} />
      </div>
      <div className={clsx(authStyles.container, 'fr-container')}>
        <h1>{t('ownerTitle')}</h1>
        <p>{t('requiredFieldsNotice')}</p>
        <SignInMethodSwitcher callbackURL={safeCallbackPath(callbackUrl, '/bailleur/') ?? '/bailleur/tableau-de-bord'} />
        <div className={authStyles.dividerContainer}>
          <span className={authStyles.divider}>{t('labels.or')}</span>
        </div>
        <div className={authStyles.firstVisitContainer}>
          <h2>{t('firstVisit.ownerTitle')}</h2>
          <p>{t('firstVisit.ownerDescription')}</p>
          <Button
            priority="secondary"
            iconPosition="left"
            iconId="ri-calendar-line"
            linkProps={{ href: calendlyUrl, target: '_blank', title: tA11y('linkNewWindow', { label: t('firstVisit.ownerCta') }) }}
          >
            {t('firstVisit.ownerCta')}
          </Button>
        </div>
      </div>
    </>
  )
}
