'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { FC, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { sendMagicLink } from '~/components/magic-link-sign-in/actions'
import { LOGIN_OTP_ALLOWED_ATTEMPTS, LOGIN_OTP_LENGTH } from '~/lib/login-otp'
import { trackEvent } from '~/lib/tracking'
import { createZOtpSignInForm, TOtpSignInForm } from '~/schemas/otp-sign-in/otp-sign-in'
import { authClient } from '~/services/better-auth-client'
import styles from './otp-sign-in-form.module.css'

const RESEND_COOLDOWN_SECONDS = 30

export const OtpSignInForm: FC<{ email: string; role: 'owner' | 'admin'; callbackURL: string; isCodeExpired?: boolean }> = ({
  email,
  role,
  callbackURL,
  isCodeExpired = false,
}) => {
  const t = useTranslations('login')
  const tSchemas = useTranslations('schemas')
  const schema = useMemo(() => createZOtpSignInForm(tSchemas), [tSchemas])
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<TOtpSignInForm>({ defaultValues: { code: '' }, resolver: zodResolver(schema) })

  const failures = useRef(0)
  const [isExhausted, setIsExhausted] = useState(isCodeExpired)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const onSubmit = async ({ code }: TOtpSignInForm) => {
    const result = await authClient.signIn.emailOtp({ email, otp: code })
    if (!result.error) {
      trackEvent({ category: 'Authentification', action: 'connexion gestionnaire', name: 'code' })
      window.location.assign(callbackURL)
      return
    }

    reset({ code: '' })
    if (result.error.code === 'INVALID_OTP') failures.current += 1
    const remaining = LOGIN_OTP_ALLOWED_ATTEMPTS - failures.current
    if (result.error.code === 'TOO_MANY_ATTEMPTS' || result.error.code === 'OTP_EXPIRED' || remaining <= 0) {
      setIsExhausted(true)
      return
    }

    const message =
      result.error.status === 429
        ? t('otp.errors.rateLimited')
        : result.error.code === 'INVALID_OTP'
          ? t('otp.errors.invalid', { remaining })
          : t('otp.errors.generic')
    setError('code', { message }, { shouldFocus: true })
  }

  const onResend = async () => {
    setCooldown(RESEND_COOLDOWN_SECONDS)
    try {
      await sendMagicLink(email, role, callbackURL)
      failures.current = 0
      setIsExhausted(false)
      reset({ code: '' })
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'otp-sign-in' } })
      setCooldown(0)
      setError('code', { message: t('otp.errors.generic') })
    }
  }

  return (
    <div className="fr-flex fr-direction-column fr-gap-4v">
      <Input label={t('labels.email')} disabled nativeInputProps={{ value: email, readOnly: true, autoComplete: 'email' }} />

      {cooldown > 0 && <Alert severity="info" small description={t('otp.resent')} />}

      {isExhausted ? (
        <Alert severity="warning" small description={t('otp.errors.exhausted')} />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            label={t('otp.label')}
            hintText={t('otp.hint')}
            state={errors.code ? 'error' : undefined}
            stateRelatedMessage={errors.code?.message}
            nativeInputProps={{
              ...register('code'),
              className: styles.code,
              inputMode: 'numeric',
              autoComplete: 'one-time-code',
              maxLength: LOGIN_OTP_LENGTH,
            }}
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('otp.submitting') : t('otp.submit')}
          </Button>
        </form>
      )}

      <div>
        <Button
          type="button"
          priority={isExhausted ? 'primary' : 'tertiary'}
          iconId="ri-mail-send-line"
          disabled={cooldown > 0}
          onClick={onResend}
        >
          {cooldown > 0 ? t('otp.resendIn', { seconds: cooldown }) : t('otp.resend')}
        </Button>
      </div>
    </div>
  )
}
