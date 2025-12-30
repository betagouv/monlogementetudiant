'use client'

import { fr } from '@codegouvfr/react-dsfr'
import Button from '@codegouvfr/react-dsfr/Button'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import clsx from 'clsx'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { FC, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { tss } from 'tss-react'
import { useStudentRegistration } from '~/hooks/use-student-registration'
import { ZSignUpForm } from '~/schemas/sign-up/sign-up'

export const SignUpForm: FC = () => {
  const t = useTranslations('signUp')
  const [showPassword, setShowPassword] = useState(false)
  const { mutateAsync, isLoading } = useStudentRegistration()

  const { classes } = useStyles()

  const loginForm = useForm({
    defaultValues: {
      firstname: '',
      lastname: '',
      email: '',
      password: '',
    },
    resolver: zodResolver(ZSignUpForm),
  })
  const { formState, getValues, handleSubmit, register } = loginForm

  const onSubmit = async () => await mutateAsync(getValues())

  const { errors } = formState
  const { lastname, firstname, email, password } = errors || {}
  return (
    <FormProvider {...loginForm}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Input
          label={
            <>
              {t('labels.lastname')}
              &nbsp;<span className={clsx(fr.cx('fr-text--bold'), classes.required)}>*</span>{' '}
            </>
          }
          state={lastname ? 'error' : undefined}
          stateRelatedMessage={lastname?.message}
          nativeInputProps={{
            ...register('lastname'),
          }}
        />
        <Input
          label={
            <>
              {t('labels.firstname')}
              &nbsp;<span className={clsx(fr.cx('fr-text--bold'), classes.required)}>*</span>{' '}
            </>
          }
          state={firstname ? 'error' : undefined}
          stateRelatedMessage={firstname?.message}
          nativeInputProps={{
            ...register('firstname'),
          }}
        />
        <Input
          label={
            <>
              {t('labels.email')}
              &nbsp;<span className={clsx(fr.cx('fr-text--bold'), classes.required)}>*</span>{' '}
            </>
          }
          state={email ? 'error' : undefined}
          stateRelatedMessage={email?.message}
          nativeInputProps={{
            ...register('email'),
          }}
        />

        <Input
          addon={
            <Button
              iconId="ri-eye-line"
              priority="tertiary"
              type="button"
              title="Afficher le mot de passe"
              nativeButtonProps={{ onClick: () => setShowPassword(!showPassword) }}
            />
          }
          hintText={t('labels.passwordHintText')}
          label={
            <>
              {t('labels.password')}
              &nbsp;<span className={clsx(fr.cx('fr-text--bold'), classes.required)}>*</span>
            </>
          }
          state={password ? 'error' : undefined}
          stateRelatedMessage={password?.message}
          nativeInputProps={{
            ...register('password'),
            type: showPassword ? 'text' : 'password',
          }}
        />
        <div className={classes.ctasContainer}>
          <Button type="submit" iconPosition="right" iconId="ri-arrow-right-line" disabled={isLoading}>
            {isLoading ? 'Inscription en cours...' : t('labels.cta')}
          </Button>
          <div>
            <Link className={fr.cx('fr-link')} href="/politique-de-confidentialite">
              {t('labels.privacyPolicy')}
            </Link>
          </div>
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
  ctasContainer: {
    display: 'flex',
    '@media (min-width: 768px)': {
      justifyContent: 'space-between',
      alignItems: 'center',
      flexDirection: 'row',
    },
    '@media (max-width: 768px)': {
      flexDirection: 'column-reverse',
      gap: '1rem',
    },
  },
})
