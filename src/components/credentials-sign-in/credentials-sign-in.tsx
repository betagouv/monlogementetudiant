'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import * as Sentry from '@sentry/nextjs'
import clsx from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FC, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { tss } from 'tss-react'
import { resendVerificationEmail } from '~/components/credentials-sign-in/actions'
import { createToast } from '~/components/ui/createToast'
import { trackEvent } from '~/lib/tracking'
import { ZCredentialsSignInForm } from '~/schemas/credentials-sign-in/credentials-sign-in'
import { signInCredentials } from '~/services/better-auth-client'

export const CredentialsSignInForm: FC = () => {
  const t = useTranslations('login')
  const router = useRouter()
  const { classes } = useStyles()
  const [isLoading, setIsLoading] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [resent, setResent] = useState(false)

  const loginForm = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    resolver: zodResolver(ZCredentialsSignInForm),
  })
  const { formState, getValues, handleSubmit, register } = loginForm

  const onSubmit = async () => {
    const data = getValues()
    setIsLoading(true)
    setUnverifiedEmail(null)
    setResent(false)

    try {
      const result = await signInCredentials(data.email, data.password)

      if ('error' in result) {
        if (result.code === 'EMAIL_NOT_VERIFIED') {
          trackEvent({ category: 'Authentification', action: 'connexion etudiant', name: 'email-non-verifie' })
          setUnverifiedEmail(data.email)
        } else {
          trackEvent({ category: 'Authentification', action: 'connexion etudiant', name: 'erreur' })
          createToast({
            priority: 'error',
            message: 'Email ou mot de passe incorrect.',
          })
        }
      } else if (result.success) {
        trackEvent({ category: 'Authentification', action: 'connexion etudiant', name: 'succes' })
        createToast({
          priority: 'success',
          message: 'Vous êtes connecté avec succès !',
        })
        router.push(result.redirectUrl)
        router.refresh()
      } else {
        trackEvent({ category: 'Authentification', action: 'connexion etudiant', name: 'erreur' })
        createToast({
          priority: 'error',
          message: 'Une erreur est survenue lors de la connexion.',
        })
      }
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'credentials-sign-in' } })
      trackEvent({ category: 'Authentification', action: 'connexion etudiant', name: 'erreur' })
      createToast({
        priority: 'error',
        message: 'Une erreur est survenue lors de la connexion.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const onResend = async () => {
    if (!unverifiedEmail) return
    setIsResending(true)

    try {
      await resendVerificationEmail(unverifiedEmail)
      trackEvent({ category: 'Authentification', action: 'connexion etudiant', name: 'renvoi-verification' })
      setResent(true)
      createToast({
        priority: 'success',
        message: t('unverified.resendSuccess'),
      })
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'credentials-sign-in', step: 'resend-verification' } })
      createToast({
        priority: 'error',
        message: t('unverified.resendError'),
      })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <FormProvider {...loginForm}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={classes.formContainer}>
          {unverifiedEmail && (
            <Alert
              severity="error"
              title={t('unverified.title')}
              description={
                <div className={classes.alertContent}>
                  <p>{t('unverified.description')}</p>
                  <Button type="button" priority="secondary" disabled={isResending || resent} onClick={onResend}>
                    {isResending ? t('unverified.resending') : resent ? t('unverified.resendSuccess') : t('unverified.resendCta')}
                  </Button>
                </div>
              }
            />
          )}
          <div className={classes.inputContainer}>
            <Input
              label={
                <>
                  {t('labels.email')}
                  &nbsp;<span className={clsx(fr.cx('fr-text--bold'), classes.required)}>*</span>{' '}
                </>
              }
              state={formState.errors.email ? 'error' : undefined}
              stateRelatedMessage={formState.errors.email?.message}
              nativeInputProps={{
                ...register('email'),
              }}
            />
            <Input
              label={
                <>
                  {t('labels.password')}
                  &nbsp;<span className={clsx(fr.cx('fr-text--bold'), classes.required)}>*</span>{' '}
                </>
              }
              state={formState.errors.password ? 'error' : undefined}
              stateRelatedMessage={formState.errors.password?.message}
              nativeInputProps={{
                ...register('password'),
                type: 'password',
              }}
            />
          </div>
          <div>
            <Link className={fr.cx('fr-link')} href="/mot-de-passe-oublie">
              {t('labels.forgotPassword')}
            </Link>
          </div>
          <Button type="submit" iconPosition="right" iconId={isLoading ? 'ri-loader-4-line' : 'ri-arrow-right-line'} disabled={isLoading}>
            {isLoading ? 'Connexion en cours...' : t('labels.cta')}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}

const useStyles = tss.create({
  inputContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  required: {
    color: 'red',
  },
  alertContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    alignItems: 'flex-start',
  },
})
