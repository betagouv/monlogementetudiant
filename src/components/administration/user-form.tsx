'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Checkbox from '@codegouvfr/react-dsfr/Checkbox'
import Input from '@codegouvfr/react-dsfr/Input'
import RadioButtons from '@codegouvfr/react-dsfr/RadioButtons'
import Select from '@codegouvfr/react-dsfr/Select'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { BAILLEUR_PERMISSIONS, BAILLEUR_ROLES, type BailleurPermission } from '~/server/bailleur/permissions'

const userFormSchema = z.object({
  email: z.string().email('Email invalide'),
  firstname: z.string().min(1, 'Le prénom est requis'),
  lastname: z.string().min(1, 'Le nom est requis'),
  role: z.enum(['admin', 'owner', 'user']),
  bailleurRole: z.enum(BAILLEUR_ROLES).nullable().optional(),
  bailleurPermissions: z.array(z.enum(BAILLEUR_PERMISSIONS)).optional(),
})

export type UserFormData = z.infer<typeof userFormSchema>

interface UserFormProps {
  defaultValues?: Partial<UserFormData>
  onSubmit: (data: UserFormData) => void
  isPending?: boolean
  submitLabel?: string
}

export const UserForm = ({ defaultValues, onSubmit, isPending, submitLabel = 'Enregistrer' }: UserFormProps) => {
  const tUsers = useTranslations('bailleur.users')

  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: '',
      firstname: '',
      lastname: '',
      role: 'user',
      bailleurRole: null,
      bailleurPermissions: [],
      ...defaultValues,
    },
  })

  const role = watch('role')
  const bailleurRole = watch('bailleurRole')
  const selectedPermissions = watch('bailleurPermissions') ?? []
  const isOwner = role === 'owner'
  const isAdministrator = bailleurRole === 'administrator'

  const togglePermission = (permission: BailleurPermission, checked: boolean) => {
    const next = checked ? [...selectedPermissions, permission] : selectedPermissions.filter((p) => p !== permission)
    setValue('bailleurPermissions', next, { shouldValidate: true })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        label="Email"
        nativeInputProps={{ type: 'email', ...register('email') }}
        state={errors.email ? 'error' : 'default'}
        stateRelatedMessage={errors.email?.message}
      />
      <Input
        label="Prénom"
        nativeInputProps={register('firstname')}
        state={errors.firstname ? 'error' : 'default'}
        stateRelatedMessage={errors.firstname?.message}
      />
      <Input
        label="Nom"
        nativeInputProps={register('lastname')}
        state={errors.lastname ? 'error' : 'default'}
        stateRelatedMessage={errors.lastname?.message}
      />
      <Select
        label="Rôle"
        nativeSelectProps={register('role')}
        state={errors.role ? 'error' : 'default'}
        stateRelatedMessage={errors.role?.message}
      >
        <option value="user">Étudiant</option>
        <option value="owner">Gestionnaire</option>
        <option value="admin">Administrateur</option>
      </Select>

      {isOwner && (
        <>
          <Controller
            control={control}
            name="bailleurRole"
            render={({ field }) => (
              <RadioButtons
                legend={tUsers('form.bailleurRoleAdminScope')}
                orientation="horizontal"
                options={BAILLEUR_ROLES.map((r) => ({
                  label: tUsers(`role.${r}`),
                  nativeInputProps: {
                    value: r,
                    checked: field.value === r,
                    onChange: () => field.onChange(r),
                  },
                }))}
              />
            )}
          />

          <Checkbox
            legend={tUsers('form.permissions')}
            hintText={isAdministrator ? tUsers('form.administratorHint') : tUsers('form.gestionnaireHint')}
            options={BAILLEUR_PERMISSIONS.map((permission) => ({
              label: tUsers(`permission.${permission}`),
              nativeInputProps: {
                value: permission,
                checked: isAdministrator ? true : selectedPermissions.includes(permission),
                disabled: isAdministrator,
                onChange: (e) => togglePermission(permission, e.target.checked),
              },
            }))}
          />
        </>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Enregistrement...' : submitLabel}
      </Button>
    </form>
  )
}
