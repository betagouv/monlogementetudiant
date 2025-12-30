'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { tss } from 'tss-react'
import { createToast } from '~/components/ui/createToast'
import { TMagicLinkSignInForm, ZMagicLinkSignInForm } from '~/schemas/magic-link-sign-in/magic-link-sign-in'

export const MagicLinkSignInForm: FC = () => {
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
      const response = await fetch('/api/admin-auth/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        createToast({
          priority: 'success',
          message: t('success'),
        })
      } else {
        createToast({
          priority: 'error',
          message: 'Une erreur est survenue lors de la connexion, veuillez réessayé ultérieurement',
        })
      }
    } catch {
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
          </div>
          <Button type="submit" iconPosition="right" iconId="ri-arrow-right-line">
            {t('labels.cta')}
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
