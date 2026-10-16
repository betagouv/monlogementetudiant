import clsx from 'clsx'
import { Metadata } from 'next'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { MagicLinkRedirect } from '~/components/magic-link-redirect/magic-link-redirect'
import { LoginLinkRecovery } from '~/components/otp-sign-in/login-link-recovery'
import { OtpSignInForm } from '~/components/otp-sign-in/otp-sign-in-form'
import background from '~/images/connexion.svg'
import { getSafeVerifyUrl, resolveLoginLinkOutcome } from '~/server/services/login-link-outcome'
import { getServerSession } from '~/services/better-auth'
import authStyles from '../../auth.module.css'

export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const tMeta = await getTranslations('metadata')
  return {
    title: tMeta('verificationBuffer.title'),
    description: tMeta('verificationBuffer.description'),
  }
}

interface VerificationBufferPageProps {
  searchParams: Promise<{ url?: string }>
}

export default async function VerificationBufferPage({ searchParams }: VerificationBufferPageProps) {
  const t = await getTranslations('verification.buffer')
  const { url } = await searchParams

  const safeUrl = getSafeVerifyUrl(url)
  if (!safeUrl) {
    notFound()
  }

  const outcome = await resolveLoginLinkOutcome(safeUrl)
  if (outcome.kind === 'error') redirect(outcome.redirectTo)

  if (outcome.kind === 'redirect') {
    return (
      <>
        <div className={authStyles.imageContainer}>
          <Image className={authStyles.image} src={background} alt="" priority quality={100} />
        </div>
        <div className={clsx(authStyles.container, 'fr-container')}>
          <h1>{t('title')}</h1>
          <p>{t('description')}</p>
          <p className="fr-text--sm">
            {t('fallbackText')}
            <br />
            <a href={safeUrl}>{t('fallbackLink')}</a>
          </p>
        </div>
        <MagicLinkRedirect url={safeUrl} />
      </>
    )
  }

  const session = await getServerSession()
  if (session?.user.email === outcome.email) redirect(outcome.callbackURL)

  const otpForm =
    outcome.kind === 'otp' ? (
      <>
        <p>{outcome.isCodeExpired ? t('expiredDescription') : t('consumedDescription')}</p>
        <OtpSignInForm email={outcome.email} role={outcome.role} callbackURL={outcome.callbackURL} isCodeExpired={outcome.isCodeExpired} />
      </>
    ) : null

  return (
    <>
      <div className={authStyles.imageContainer}>
        <Image className={authStyles.image} src={background} alt="" priority quality={100} />
      </div>
      <div className={clsx(authStyles.container, 'fr-container')}>
        <h1>{t('otpTitle')}</h1>
        {outcome.kind === 'recover' ? (
          <LoginLinkRecovery verifyUrl={safeUrl} callbackURL={outcome.callbackURL} fallback={<p>{t('recoveryFailed')}</p>} />
        ) : (
          otpForm
        )}
      </div>
    </>
  )
}
