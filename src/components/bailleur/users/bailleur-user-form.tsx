'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Checkbox from '@codegouvfr/react-dsfr/Checkbox'
import Input from '@codegouvfr/react-dsfr/Input'
import RadioButtons from '@codegouvfr/react-dsfr/RadioButtons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import {
  BAILLEUR_PERMISSIONS,
  BAILLEUR_ROLES,
  type BailleurPermission,
  canGrantApplicationsPermission,
  MAX_BAILLEUR_ADMINISTRATORS,
} from '~/server/bailleur/permissions'

const formSchema = z.object({
  email: z.string().email('bailleur.users.form.errors.emailInvalid'),
  firstname: z.string().min(1, 'bailleur.users.form.errors.firstnameRequired'),
  lastname: z.string().min(1, 'bailleur.users.form.errors.lastnameRequired'),
  bailleurRole: z.enum(BAILLEUR_ROLES),
  bailleurPermissions: z.array(z.enum(BAILLEUR_PERMISSIONS)),
})

export type BailleurUserFormData = z.infer<typeof formSchema>

type Props = {
  defaultValues?: Partial<BailleurUserFormData>
  onSubmit: (data: BailleurUserFormData) => void
  isPending?: boolean
  submitLabel?: string
  /** Quand `false`, le choix `administrator` n'est pas propose. */
  canGrantAdministratorRights?: boolean
  /**
   * Parcours de candidature du bailleur. `none` rend « Gestion des candidats » non cochable :
   * l'autorisation n'ouvre aucun ecran tant qu'aucun parcours n'est choisi.
   */
  ownerContactMode: EOwnerContactMode
  /**
   * Quand `true`, le bailleur a deja son quota d'administrateurs : le choix reste selectionnable
   * (l'utilisateur doit pouvoir declencher l'explication) mais un texte d'aide l'annonce.
   */
  administratorLimitReached?: boolean
}

export const BailleurUserForm = ({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
  canGrantAdministratorRights = true,
  administratorLimitReached = false,
  ownerContactMode,
}: Props) => {
  const t = useTranslations('bailleur.users')

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BailleurUserFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      firstname: '',
      lastname: '',
      bailleurRole: 'gestionnaire',
      bailleurPermissions: [],
      ...defaultValues,
    },
  })

  const bailleurRole = watch('bailleurRole')
  const selectedPermissions = watch('bailleurPermissions')
  const isAdministrator = bailleurRole === 'administrator'
  const canGrantApplications = canGrantApplicationsPermission(ownerContactMode)

  const togglePermission = (permission: BailleurPermission, checked: boolean) => {
    const current = selectedPermissions ?? []
    const next = checked ? [...current, permission] : current.filter((p) => p !== permission)
    setValue('bailleurPermissions', next, { shouldValidate: true })
  }

  const translateError = (key?: string) => (key ? t(key.replace('bailleur.users.', '') as Parameters<typeof t>[0]) : undefined)

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        label={t('form.email')}
        nativeInputProps={{ type: 'email', ...register('email') }}
        state={errors.email ? 'error' : 'default'}
        stateRelatedMessage={translateError(errors.email?.message)}
      />
      <Input
        label={t('form.firstname')}
        nativeInputProps={register('firstname')}
        state={errors.firstname ? 'error' : 'default'}
        stateRelatedMessage={translateError(errors.firstname?.message)}
      />
      <Input
        label={t('form.lastname')}
        nativeInputProps={register('lastname')}
        state={errors.lastname ? 'error' : 'default'}
        stateRelatedMessage={translateError(errors.lastname?.message)}
      />

      <Controller
        control={control}
        name="bailleurRole"
        render={({ field }) => (
          <RadioButtons
            legend={t('form.bailleurRole')}
            hintText={administratorLimitReached ? t('adminLimit.hint', { max: MAX_BAILLEUR_ADMINISTRATORS }) : undefined}
            orientation="horizontal"
            options={BAILLEUR_ROLES.filter((role) => canGrantAdministratorRights || role !== 'administrator').map((role) => ({
              label: t(`role.${role}`),
              nativeInputProps: {
                value: role,
                checked: field.value === role,
                onChange: () => field.onChange(role),
              },
            }))}
          />
        )}
      />

      <Checkbox
        legend={t('form.permissions')}
        hintText={isAdministrator ? t('form.administratorHint') : t('form.gestionnaireHint')}
        options={BAILLEUR_PERMISSIONS.map((permission) => {
          const blockedByContactMode = permission === 'manage_applications' && !canGrantApplications
          return {
            label: t(`permission.${permission}`),
            hintText:
              permission === 'manage_applications'
                ? blockedByContactMode
                  ? t('permission.applicationsRequiresContactMode')
                  : t('permission.applicationsRgpdHint')
                : undefined,
            nativeInputProps: {
              value: permission,
              checked: isAdministrator ? true : (selectedPermissions ?? []).includes(permission),
              disabled: isAdministrator || blockedByContactMode,
              onChange: (e) => togglePermission(permission, e.target.checked),
            },
          }
        })}
      />

      <div className="fr-mt-2w">
        <Button type="submit" disabled={isPending}>
          {isPending ? t('saving') : (submitLabel ?? t('submitUpdate'))}
        </Button>
      </div>
    </form>
  )
}
