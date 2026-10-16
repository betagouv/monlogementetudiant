'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import * as Sentry from '@sentry/nextjs'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { ClipboardEvent, FC, FormEvent, KeyboardEvent, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import { sendMagicLink } from '~/components/magic-link-sign-in/actions'
import { LOGIN_OTP_ALLOWED_ATTEMPTS, LOGIN_OTP_LENGTH } from '~/lib/login-otp'
import { trackEvent } from '~/lib/tracking'
import { createZOtpCode } from '~/schemas/otp-sign-in/otp-sign-in'
import { authClient } from '~/services/better-auth-client'
import styles from './otp-sign-in-form.module.css'

const RESEND_COOLDOWN_SECONDS = 30

type TOtpError = { kind: 'invalid'; remaining: number } | { kind: 'exhausted' | 'rateLimited' | 'generic' }

const emptyDigits = () => Array.from({ length: LOGIN_OTP_LENGTH }, () => '')

export const OtpSignInForm: FC<{ email: string; role: 'owner' | 'admin'; callbackURL: string; isCodeExpired?: boolean }> = ({
  email,
  role,
  callbackURL,
  isCodeExpired = false,
}) => {
  const t = useTranslations('login')
  const tSchemas = useTranslations('schemas')
  const codeSchema = useMemo(() => createZOtpCode(tSchemas), [tSchemas])
  const hintId = useId()
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])

  const [digits, setDigits] = useState(emptyDigits)
  const [error, setError] = useState<TOtpError | null>(isCodeExpired ? { kind: 'exhausted' } : null)
  const [cooldown, setCooldown] = useState(0)
  const [isSubmitting, startSubmit] = useTransition()

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const isExhausted = error?.kind === 'exhausted'
  const code = digits.join('')

  const focusDigit = (index: number) => inputsRef.current[Math.max(0, Math.min(index, LOGIN_OTP_LENGTH - 1))]?.focus()

  const fillFrom = (index: number, value: string) => {
    const chars = value
      .replace(/\D/g, '')
      .slice(0, LOGIN_OTP_LENGTH - index)
      .split('')
    if (chars.length === 0) return
    setDigits((current) => current.map((digit, i) => (i >= index && i < index + chars.length ? chars[i - index] : digit)))
    focusDigit(index + chars.length)
  }

  const onChange = (index: number, value: string) => {
    if (value === '') {
      setDigits((current) => current.map((digit, i) => (i === index ? '' : digit)))
      return
    }
    fillFrom(index, value)
  }

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && digits[index] === '' && index > 0) {
      event.preventDefault()
      setDigits((current) => current.map((digit, i) => (i === index - 1 ? '' : digit)))
      focusDigit(index - 1)
    }
    if (event.key === 'ArrowLeft') focusDigit(index - 1)
    if (event.key === 'ArrowRight') focusDigit(index + 1)
  }

  const onPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    fillFrom(index, event.clipboardData.getData('text'))
  }

  const toError = (result: { status: number; code?: string }): TOtpError => {
    if (result.status === 429) return { kind: 'rateLimited' }
    if (result.code === 'TOO_MANY_ATTEMPTS' || result.code === 'OTP_EXPIRED') return { kind: 'exhausted' }
    if (result.code !== 'INVALID_OTP') return { kind: 'generic' }
    const remaining = (error?.kind === 'invalid' ? error.remaining : LOGIN_OTP_ALLOWED_ATTEMPTS) - 1
    return remaining > 0 ? { kind: 'invalid', remaining } : { kind: 'exhausted' }
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = codeSchema.safeParse(code)
    if (!parsed.success) return

    startSubmit(async () => {
      const result = await authClient.signIn.emailOtp({ email, otp: parsed.data })
      if (!result.error) {
        trackEvent({ category: 'Authentification', action: 'connexion gestionnaire', name: 'code' })
        window.location.assign(callbackURL)
        return
      }
      setError(toError(result.error))
      setDigits(emptyDigits())
      focusDigit(0)
    })
  }

  const onResend = async () => {
    setCooldown(RESEND_COOLDOWN_SECONDS)
    try {
      await sendMagicLink(email, role, callbackURL)
      setError(null)
      setDigits(emptyDigits())
    } catch (resendError) {
      Sentry.captureException(resendError, { tags: { feature: 'otp-sign-in' } })
      setError({ kind: 'generic' })
    }
  }

  const errorMessage = (() => {
    if (!error) return null
    if (error.kind === 'invalid') return t('otp.errors.invalid', { remaining: error.remaining })
    return t(`otp.errors.${error.kind}`)
  })()

  return (
    <div className="fr-flex fr-direction-column fr-gap-4v">
      <Input label={t('labels.email')} disabled nativeInputProps={{ value: email, readOnly: true, autoComplete: 'email' }} />

      {cooldown > 0 && error?.kind !== 'generic' && <Alert severity="info" small description={t('otp.resent')} />}

      {!isExhausted && (
        <form onSubmit={onSubmit} noValidate>
          <fieldset className={clsx('fr-fieldset', errorMessage && 'fr-fieldset--error')} aria-describedby={hintId}>
            <legend className="fr-fieldset__legend">
              {t('otp.legend')}
              <span className="fr-hint-text" id={hintId}>
                {t('otp.hint')}
              </span>
            </legend>
            <div className={clsx('fr-fieldset__element', styles.digits)}>
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputsRef.current[index] = element
                  }}
                  className={clsx('fr-input', styles.digit)}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={LOGIN_OTP_LENGTH}
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={t('otp.digitLabel', { index: index + 1, total: LOGIN_OTP_LENGTH })}
                  value={digit}
                  onChange={(event) => onChange(index, event.target.value)}
                  onKeyDown={(event) => onKeyDown(index, event)}
                  onPaste={(event) => onPaste(index, event)}
                />
              ))}
            </div>
            {errorMessage && (
              <div className="fr-messages-group" aria-live="polite">
                <p className="fr-message fr-message--error">{errorMessage}</p>
              </div>
            )}
          </fieldset>
          <Button type="submit" disabled={isSubmitting || !codeSchema.safeParse(code).success}>
            {isSubmitting ? t('otp.submitting') : t('otp.submit')}
          </Button>
        </form>
      )}

      {isExhausted && errorMessage && <Alert severity="warning" small description={errorMessage} />}

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
