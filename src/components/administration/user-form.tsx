'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import RadioButtons from '@codegouvfr/react-dsfr/RadioButtons'
import Select from '@codegouvfr/react-dsfr/Select'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { BailleurPermissionsFields } from '~/components/bailleur/users/bailleur-permissions-fields'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import {
  BAILLEUR_PERMISSIONS,
  BAILLEUR_ROLES,
  type BailleurRole,
  defaultGestionnairePermissions,
  hasUsableGestionnairePermissions,
} from '~/server/bailleur/permissions'

const userFormSchema = z
  .object({
    email: z.string().email('Email invalide'),
    firstname: z.string().min(1, 'Le prénom est requis'),
    lastname: z.string().min(1, 'Le nom est requis'),
    role: z.enum(['admin', 'owner', 'user']),
    bailleurRole: z.enum(BAILLEUR_ROLES).nullable().optional(),
    bailleurPermissions: z.array(z.enum(BAILLEUR_PERMISSIONS)).optional(),
  })
  // Un gestionnaire sans autorisation ne peut ouvrir aucun ecran : on refuse la selection vide.
  .refine(
    (values) =>
      values.role !== 'owner' ||
      values.bailleurRole !== 'gestionnaire' ||
      hasUsableGestionnairePermissions(values.bailleurPermissions ?? []),
    {
      path: ['bailleurPermissions'],
      message: 'Sélectionnez au moins une autorisation',
    },
  )

export type UserFormData = z.infer<typeof userFormSchema>

interface UserFormProps {
  defaultValues?: Partial<UserFormData>
  onSubmit: (data: UserFormData) => void
  isPending?: boolean
  submitLabel?: string
  hideRoleField?: boolean
  ownerContactMode?: EOwnerContactMode
}

export const UserForm = ({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel = 'Enregistrer',
  hideRoleField,
  ownerContactMode = EOwnerContactMode.NONE,
}: UserFormProps) => {
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
      // Gestionnaire par defaut : le role administrateur se donne explicitement.
      bailleurRole: 'gestionnaire',
      // Un gestionnaire sans autorisation n'ouvre aucun ecran : on part des autorisations par defaut.
      // L'edition d'un compte existant repasse ses propres valeurs juste apres.
      bailleurPermissions: defaultGestionnairePermissions(ownerContactMode),
      ...defaultValues,
    },
  })

  const role = watch('role')
  const bailleurRole = watch('bailleurRole')
  const selectedPermissions = watch('bailleurPermissions') ?? []
  const isOwner = role === 'owner'

  // Un administrateur a toutes les autorisations : en repassant gestionnaire, la selection
  // affichee redeviendrait vide. On repropose les autorisations par defaut.
  const selectBailleurRole = (nextRole: BailleurRole, onRoleChange: (role: BailleurRole) => void) => {
    onRoleChange(nextRole)
    if (nextRole === 'gestionnaire' && selectedPermissions.length === 0) {
      setValue('bailleurPermissions', defaultGestionnairePermissions(ownerContactMode), { shouldValidate: true })
    }
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
      {!hideRoleField && (
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
      )}

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
                    onChange: () => selectBailleurRole(r, field.onChange),
                  },
                }))}
              />
            )}
          />

          <BailleurPermissionsFields
            bailleurRole={bailleurRole}
            ownerContactMode={ownerContactMode}
            selectedPermissions={selectedPermissions}
            onChange={(permissions) => setValue('bailleurPermissions', permissions, { shouldValidate: true })}
            errorMessage={errors.bailleurPermissions?.message}
          />
        </>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Enregistrement...' : submitLabel}
      </Button>
    </form>
  )
}
