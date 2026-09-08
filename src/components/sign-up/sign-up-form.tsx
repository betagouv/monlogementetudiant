'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { PasswordInput } from '@codegouvfr/react-dsfr/blocks/PasswordInput'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { FC } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { tss } from 'tss-react'
import { StudentProfileFields } from '~/components/student-space/profile/student-profile-fields'
import { RequiredLabel } from '~/components/ui/required-mark'
import { usePasswordRuleMessages } from '~/hooks/use-password-rule-messages'
import { useStudentRegistration } from '~/hooks/use-student-registration'
import { type TSignUpForm, ZSignUpForm } from '~/schemas/sign-up/sign-up'
import type { TClaimedContactRequest } from '~/server/contacts/claimed-request'

interface Props {
  /** Coordonnées déjà saisies lors d'une demande de contact en visiteur (voir `?claim=`). */
  prefill?: TClaimedContactRequest | null
}

export const SignUpForm: FC<Props> = ({ prefill }) => {
  const t = useTranslations('signUp')
  const { mutateAsync, isLoading } = useStudentRegistration()

  const { classes } = useStyles()

  const loginForm = useForm<TSignUpForm>({
    defaultValues: {
      firstname: prefill?.firstname ?? '',
      lastname: prefill?.lastname ?? '',
      email: prefill?.email ?? '',
      password: '',
      phone: prefill?.phone ?? '',
      birthdate: '',
      // scholarshipStatus laissé indéfini jusqu'à sélection
    },
    resolver: zodResolver(ZSignUpForm),
  })
  const { formState, handleSubmit, register } = loginForm

  const onSubmit = handleSubmit(async (data) => await mutateAsync(data))

  const { errors } = formState
  const { lastname, firstname, email, password } = errors || {}
  const passwordRules = usePasswordRuleMessages(!!password)
  return (
    <FormProvider {...loginForm}>
      <form onSubmit={onSubmit}>
        <Input
          label={<RequiredLabel>{t('labels.lastname')}</RequiredLabel>}
          state={lastname ? 'error' : undefined}
          stateRelatedMessage={lastname?.message}
          nativeInputProps={{
            ...register('lastname'),
          }}
        />
        <Input
          label={<RequiredLabel>{t('labels.firstname')}</RequiredLabel>}
          state={firstname ? 'error' : undefined}
          stateRelatedMessage={firstname?.message}
          nativeInputProps={{
            ...register('firstname'),
          }}
        />
        <Input
          label={<RequiredLabel>{t('labels.email')}</RequiredLabel>}
          state={email ? 'error' : undefined}
          stateRelatedMessage={email?.message}
          nativeInputProps={{
            ...register('email'),
          }}
        />

        <StudentProfileFields />

        <PasswordInput
          label={<RequiredLabel>{t('labels.password')}</RequiredLabel>}
          messagesHint={passwordRules.messagesHint}
          messages={passwordRules.messages}
          nativeInputProps={{
            ...register('password'),
          }}
        />
        <div className={classes.ctasContainer}>
          <Button type="submit" iconPosition="right" iconId="ri-arrow-right-line" disabled={isLoading}>
            {isLoading ? 'Inscription en cours...' : t('labels.cta')}
          </Button>
          <div>
            <Link className="fr-link" href="/politique-de-confidentialite">
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
  ctasContainer: {
    display: 'flex',
    marginTop: '1.5rem',
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
