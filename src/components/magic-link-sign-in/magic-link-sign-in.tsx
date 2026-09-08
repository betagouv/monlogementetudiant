'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { tss } from 'tss-react'
import { createToast } from '~/components/ui/createToast'
import { RequiredLabel } from '~/components/ui/required-mark'
import { trackEvent } from '~/lib/tracking'
import { TMagicLinkSignInForm, ZMagicLinkSignInForm } from '~/schemas/magic-link-sign-in/magic-link-sign-in'
import { sendMagicLink } from './actions'

export const MagicLinkSignInForm: FC<{ callbackURL?: string; type?: 'owner' | 'admin' }> = ({ callbackURL, type = 'owner' }) => {
  const t = useTranslations('login')
  const { classes } = useStyles()

  const loginForm = useForm<TMagicLinkSignInForm>({
    defaultValues: {
      email: '',
    },
    resolver: zodResolver(ZMagicLinkSignInForm),
  })
  const { formState, getValues, handleSubmit, register } = loginForm

  const onSubmit = async () => {
    const { email } = getValues()
    try {
      await sendMagicLink(email, type, callbackURL)
      trackEvent({ category: 'Authentification', action: 'connexion gestionnaire', name: 'succes' })
      createToast({
        priority: 'success',
        message: t('success'),
      })
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'magic-link-sign-in' } })
      trackEvent({ category: 'Authentification', action: 'connexion gestionnaire', name: 'erreur' })
      createToast({
        priority: 'error',
        message: 'Une erreur est survenue lors de la connexion, veuillez réessayé ultérieurement',
      })
    }
  }

  return (
    <FormProvider {...loginForm}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={classes.formContainer}>
          <div className={classes.inputContainer}>
            <Input
              label={<RequiredLabel>{t('labels.email')}</RequiredLabel>}
              state={formState.errors.email ? 'error' : undefined}
              stateRelatedMessage={formState.errors.email?.message}
              nativeInputProps={{
                ...register('email'),
              }}
            />
          </div>
          <Button type="submit" iconPosition="left" iconId="ri-mail-send-line">
            {t('labels.magicLinkCta')}
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
})
