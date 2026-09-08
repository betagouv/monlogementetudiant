'use client'

import Alert from '@codegouvfr/react-dsfr/Alert'
import Button from '@codegouvfr/react-dsfr/Button'
import { PasswordInput } from '@codegouvfr/react-dsfr/blocks/PasswordInput'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { tss } from 'tss-react'
import { RequiredLabel } from '~/components/ui/required-mark'
import { usePasswordRuleMessages } from '~/hooks/use-password-rule-messages'
import { useResetPassword } from '~/hooks/use-reset-password'
import { trackEvent } from '~/lib/tracking'
import { ZResetPasswordForm } from '~/schemas/reset-password/reset-password'

export const ResetPasswordForm: FC = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const t = useTranslations('resetPassword')
  const { classes } = useStyles()
  const { mutateAsync, isLoading, isSuccess } = useResetPassword()

  const resetPasswordForm = useForm({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    resolver: zodResolver(ZResetPasswordForm),
  })
  const { getValues, handleSubmit, register } = resetPasswordForm

  const onSubmit = async () => {
    if (!token) {
      console.error('Missing token parameter')
      return
    }

    const formData = getValues()
    try {
      await mutateAsync({
        token,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      })
      trackEvent({ category: 'Authentification', action: 'reinitialisation mot de passe', name: 'succes' })
    } catch {
      trackEvent({ category: 'Authentification', action: 'reinitialisation mot de passe', name: 'erreur' })
    }
  }

  const { errors } = resetPasswordForm.formState
  const { password, confirmPassword } = errors || {}
  const passwordRules = usePasswordRuleMessages(!!password)
  return (
    <FormProvider {...resetPasswordForm}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={classes.formContainer}>
          <div className={classes.inputContainer}>
            <PasswordInput
              label={<RequiredLabel>{t('labels.newPassword')}</RequiredLabel>}
              messagesHint={passwordRules.messagesHint}
              messages={passwordRules.messages}
              nativeInputProps={{
                ...register('password'),
              }}
            />
            <PasswordInput
              label={<RequiredLabel>{t('labels.confirmPassword')}</RequiredLabel>}
              messagesHint=""
              messages={confirmPassword ? [{ severity: 'error', message: confirmPassword.message ?? '' }] : []}
              nativeInputProps={{
                ...register('confirmPassword'),
              }}
            />
          </div>

          <Button type="submit" iconPosition="right" iconId="ri-arrow-right-line" disabled={isLoading || !token}>
            {isLoading ? t('labels.resetting') : t('labels.cta')}
          </Button>
          {isSuccess && <Alert description={t('success.description')} severity="success" small />}
          {!token && <Alert description="Paramètres manquants pour réinitialiser le mot de passe" severity="error" small />}
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
})
