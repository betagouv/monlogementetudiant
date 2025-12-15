'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { FC, ReactNode, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { tss } from 'tss-react'
import { ZForgotPasswordForm } from '~/schemas/forgot-password/forgot-password'

export const ForgotPasswordForm: FC = () => {
  // todo: remove that in order to get the mutation status
  const [isSent, setIsSent] = useState(false)
  const t = useTranslations('forgotPassword')
  const { classes } = useStyles()

  const forgotPasswordForm = useForm({
    defaultValues: {
      email: '',
    },
    resolver: zodResolver(ZForgotPasswordForm),
  })
  const { getValues, handleSubmit, register } = forgotPasswordForm

  const onSubmit = async () => {
    console.log(getValues())
    setIsSent(true)
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

          <Button type="submit" iconPosition="right" iconId="ri-arrow-right-line">
            {t('labels.cta')}
          </Button>
          {isSent && <Alert description={alertDescription} severity="success" small />}
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
