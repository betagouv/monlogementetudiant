'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { FC, ReactNode } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { tss } from 'tss-react'
import { useForgotPassword } from '~/hooks/use-forgot-password'
import { trackEvent } from '~/lib/tracking'
import { ZForgotPasswordForm } from '~/schemas/forgot-password/forgot-password'

export const ForgotPasswordForm: FC = () => {
  const t = useTranslations('forgotPassword')
  const { classes } = useStyles()
  const { mutateAsync, isLoading, isSuccess } = useForgotPassword()

  const forgotPasswordForm = useForm({
    defaultValues: {
      email: '',
    },
    resolver: zodResolver(ZForgotPasswordForm),
  })
  const { getValues, handleSubmit, register } = forgotPasswordForm

  const onSubmit = async () => {
    const formData = getValues()
    await mutateAsync(formData)
    trackEvent({ category: 'Authentification', action: 'mot de passe oublie', name: 'soumis' })
  }

  const alertDescription = t.rich('success.description', {
    mailto: (chunks) => <a href="mailto:contact@monlogementetudiant.beta.gouv.fr">{chunks}</a>,
  }) as NonNullable<ReactNode>

  const { errors } = forgotPasswordForm.formState

  return (
    <FormProvider {...forgotPasswordForm}>
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
              nativeInputProps={{
                ...register('email'),
              }}
              state={errors?.email ? 'error' : undefined}
              stateRelatedMessage={errors?.email?.message}
            />
          </div>

          <Button type="submit" iconPosition="right" iconId="ri-arrow-right-line" disabled={isLoading}>
            {isLoading ? t('labels.sending') : t('labels.cta')}
          </Button>
          {isSuccess && <Alert description={alertDescription} severity="success" small />}
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
    gap: '2rem',
  },
  required: {
    color: 'red',
  },
})
