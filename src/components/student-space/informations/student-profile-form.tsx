'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { PasswordInput } from '@codegouvfr/react-dsfr/blocks/PasswordInput'
import { Input } from '@codegouvfr/react-dsfr/Input'
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons'
import Select from '@codegouvfr/react-dsfr/Select'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { createToast } from '~/components/ui/createToast'
import { RequiredFieldsNotice, RequiredLabel } from '~/components/ui/required-mark'
import { useUpdateStudentProfile } from '~/hooks/use-update-student-profile'
import { SCHOLARSHIP_TYPES, type TUpdateStudentProfileForm, ZUpdateStudentProfileForm } from '~/schemas/student/update-profile'
import { authClient } from '~/services/better-auth-client'

type StudentProfileFormProps = {
  initialValues: {
    firstname: string
    lastname: string
    email: string
    phone: string | null
    birthdate: string | null
    scholarshipStatus: 'yes' | 'no' | 'unknown' | null
    scholarshipType: (typeof SCHOLARSHIP_TYPES)[number] | null
  }
}

export const StudentProfileForm = ({ initialValues }: StudentProfileFormProps) => {
  const t = useTranslations('student.personalInformations.form')
  const { mutate: updateProfile, isPending } = useUpdateStudentProfile()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TUpdateStudentProfileForm>({
    resolver: zodResolver(ZUpdateStudentProfileForm),
    defaultValues: {
      firstname: initialValues.firstname,
      lastname: initialValues.lastname,
      phone: initialValues.phone ?? '',
      birthdate: initialValues.birthdate ?? '',
      scholarshipStatus: initialValues.scholarshipStatus ?? undefined,
      scholarshipType: initialValues.scholarshipType ?? undefined,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const scholarshipStatus = watch('scholarshipStatus')

  const onSubmit = async (data: TUpdateStudentProfileForm) => {
    if (data.newPassword && data.currentPassword) {
      const result = await authClient.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: false,
      })
      if (result.error) {
        createToast({ priority: 'error', message: t('passwordError') })
        return
      }
    }

    updateProfile({
      firstname: data.firstname,
      lastname: data.lastname,
      phone: data.phone || null,
      birthdate: data.birthdate || null,
      scholarshipStatus: data.scholarshipStatus ?? null,
      scholarshipType: data.scholarshipStatus === 'yes' ? (data.scholarshipType ?? null) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="fr-flex fr-direction-column fr-flex-gap-4v">
      <RequiredFieldsNotice />
      <div className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-12 fr-col-md-6">
          <Input
            label={<RequiredLabel>{t('lastname')}</RequiredLabel>}
            state={errors.lastname ? 'error' : undefined}
            stateRelatedMessage={errors.lastname?.message}
            nativeInputProps={{ ...register('lastname'), autoComplete: 'family-name', 'aria-required': true }}
          />
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <Input
            label={<RequiredLabel>{t('firstname')}</RequiredLabel>}
            state={errors.firstname ? 'error' : undefined}
            stateRelatedMessage={errors.firstname?.message}
            nativeInputProps={{ ...register('firstname'), autoComplete: 'given-name', 'aria-required': true }}
          />
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <Input label={t('email')} disabled nativeInputProps={{ value: initialValues.email, readOnly: true, autoComplete: 'email' }} />
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <Input
            label={t('phone')}
            state={errors.phone ? 'error' : undefined}
            stateRelatedMessage={errors.phone?.message}
            nativeInputProps={{
              ...register('phone', {
                onChange: (e) => {
                  e.target.value = e.target.value.replace(/\D/g, '')
                },
              }),
              type: 'tel',
              autoComplete: 'tel-national',
              placeholder: t('phonePlaceholder'),
              maxLength: 10,
            }}
          />
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <Input
            label={t('birthdate')}
            hintText={t('birthdateHint')}
            state={errors.birthdate ? 'error' : undefined}
            stateRelatedMessage={errors.birthdate?.message}
            nativeInputProps={{ ...register('birthdate'), type: 'date', autoComplete: 'bday' }}
          />
        </div>
      </div>

      <div className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-12 fr-col-md-6 fr-flex fr-align-items-center">
          <RadioButtons
            legend={t('scholarshipQuestion')}
            name="scholarshipStatus"
            orientation="horizontal"
            options={[
              {
                label: t('scholarshipYes'),
                nativeInputProps: {
                  value: 'yes',
                  checked: scholarshipStatus === 'yes',
                  onChange: () => setValue('scholarshipStatus', 'yes'),
                },
              },
              {
                label: t('scholarshipNo'),
                nativeInputProps: {
                  value: 'no',
                  checked: scholarshipStatus === 'no',
                  onChange: () => {
                    setValue('scholarshipStatus', 'no')
                    setValue('scholarshipType', undefined)
                  },
                },
              },
              {
                label: t('scholarshipUnknown'),
                nativeInputProps: {
                  value: 'unknown',
                  checked: scholarshipStatus === 'unknown',
                  onChange: () => {
                    setValue('scholarshipStatus', 'unknown')
                    setValue('scholarshipType', undefined)
                  },
                },
              },
            ]}
          />
        </div>
        {scholarshipStatus === 'yes' && (
          <div className="fr-col-12 fr-col-md-6">
            <Select
              label={t('scholarshipType')}
              state={errors.scholarshipType ? 'error' : undefined}
              stateRelatedMessage={errors.scholarshipType?.message}
              nativeSelectProps={register('scholarshipType', { setValueAs: (value) => value || null })}
            >
              <option value="">{t('scholarshipTypePlaceholder')}</option>
              {SCHOLARSHIP_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`scholarshipTypes.${type}`)}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="fr-border-top fr-pt-4w fr-mt-2w fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-12 fr-col-md-6">
          <PasswordInput
            label={t('currentPassword')}
            hintText={t('passwordHint')}
            messagesHint=""
            messages={errors.currentPassword ? [{ severity: 'error', message: errors.currentPassword.message ?? '' }] : []}
            nativeInputProps={{ ...register('currentPassword') }}
          />
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <PasswordInput
            label={t('newPassword')}
            hintText={t('passwordHint')}
            messagesHint=""
            messages={errors.newPassword ? [{ severity: 'error', message: errors.newPassword.message ?? '' }] : []}
            nativeInputProps={{ ...register('newPassword') }}
          />
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <PasswordInput
            label={t('confirmPassword')}
            hintText={t('passwordHint')}
            messagesHint=""
            messages={errors.confirmPassword ? [{ severity: 'error', message: errors.confirmPassword.message ?? '' }] : []}
            nativeInputProps={{ ...register('confirmPassword') }}
          />
        </div>
      </div>

      <div className="fr-flex fr-justify-content-end fr-mt-2w">
        <Button type="submit" disabled={isPending}>
          {isPending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  )
}
