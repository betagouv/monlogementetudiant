'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FC, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { tss } from 'tss-react'
import { createToast } from '~/components/ui/createToast'
import { trackEvent } from '~/lib/tracking'
import { ZCredentialsSignInForm } from '~/schemas/credentials-sign-in/credentials-sign-in'
import { signInCredentials } from '~/services/better-auth-client'

export const CredentialsSignInForm: FC = () => {
  const t = useTranslations('login')
  const router = useRouter()
  const { classes } = useStyles()
  const [isLoading, setIsLoading] = useState(false)

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

    try {
      const result = await signInCredentials(data.email, data.password)

      if ('error' in result) {
        trackEvent({ category: 'Authentification', action: 'connexion etudiant', name: 'erreur' })
        createToast({
          priority: 'error',
          message: 'Email ou mot de passe incorrect.',
        })
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
    } catch {
      trackEvent({ category: 'Authentification', action: 'connexion etudiant', name: 'erreur' })
      createToast({
        priority: 'error',
        message: 'Une erreur est survenue lors de la connexion.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <FormProvider {...loginForm}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={classes.formContainer}>
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
})
