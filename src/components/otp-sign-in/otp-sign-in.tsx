'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { useTranslations } from 'next-intl'
import { FC, useState } from 'react'
import { MagicLinkSignInForm } from '~/components/magic-link-sign-in/magic-link-sign-in'
import { createToast } from '~/components/ui/createToast'
import { authClient } from '~/services/better-auth-client'

export const OtpSignInForm: FC<{ callbackURL: string }> = ({ callbackURL }) => {
  const t = useTranslations('login')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    try {
      await authClient.emailOtp.sendVerificationOtp({ email: email.trim().toLowerCase(), type: 'sign-in' })
      // Réponse identique que le compte existe ou non : pas d'énumération d'adresses.
      setStep('code')
      createToast({ priority: 'success', message: t('otp.sendSuccess') })
    } catch {
      createToast({ priority: 'error', message: t('otp.sendError') })
    } finally {
      setPending(false)
    }
  }

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setCodeError(null)
    const result = await authClient.signIn.emailOtp({ email: email.trim().toLowerCase(), otp: code.trim() })
    setPending(false)
    if (result.error) {
      setCodeError(t('otp.codeError'))
      return
    }
    window.location.href = callbackURL
  }

  if (step === 'email') {
    return (
      <form onSubmit={sendCode} className="fr-flex fr-direction-column fr-flex-gap-4v">
        <div>
          <Input
            label={t('labels.email')}
            hintText={t('otp.emailHint')}
            nativeInputProps={{
              type: 'email',
              required: true,
              autoComplete: 'email',
              value: email,
              onChange: (e) => setEmail(e.target.value),
            }}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? t('otp.sending') : t('otp.sendCta')}
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={verifyCode} className="fr-flex fr-direction-column fr-flex-gap-4v">
      <p className="fr-text--sm fr-mb-0">{t.rich('otp.sentTo', { email, strong: (chunks) => <strong>{chunks}</strong> })}</p>
      <div>
        <Input
          label={t('otp.codeLabel')}
          state={codeError ? 'error' : 'default'}
          stateRelatedMessage={codeError ?? undefined}
          nativeInputProps={{
            type: 'text',
            required: true,
            inputMode: 'numeric',
            pattern: '[0-9]{6}',
            maxLength: 6,
            autoComplete: 'one-time-code',
            value: code,
            onChange: (e) => setCode(e.target.value),
          }}
        />
      </div>
      <Button type="submit" disabled={pending || code.length !== 6}>
        {pending ? t('otp.verifying') : t('otp.verifyCta')}
      </Button>
    </form>
  )
}

export const SignInMethodSwitcher: FC<{ callbackURL: string }> = ({ callbackURL }) => {
  const t = useTranslations('login')
  const [method, setMethod] = useState<'magic-link' | 'otp'>('magic-link')

  if (method === 'magic-link') {
    return (
      <>
        <h2 className="fr-h6 fr-mb-1w">{t('otp.linkTitle')}</h2>
        <MagicLinkSignInForm callbackURL={callbackURL} />
        <div className="fr-mt-1w">
          <Button type="button" priority="tertiary no outline" size="small" onClick={() => setMethod('otp')}>
            {t('otp.switchToOtp')}
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <h2 className="fr-h6 fr-mb-1w">{t('otp.codeTitle')}</h2>
      <OtpSignInForm callbackURL={callbackURL} />
      <div className="fr-mt-1w">
        <Button type="button" priority="tertiary no outline" size="small" onClick={() => setMethod('magic-link')}>
          {t('otp.switchToMagicLink')}
        </Button>
      </div>
    </>
  )
}
