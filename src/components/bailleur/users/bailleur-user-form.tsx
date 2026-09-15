'use client'

import Input from '@codegouvfr/react-dsfr/Input'
import Select from '@codegouvfr/react-dsfr/SelectNext'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { AccommodationSelector } from '~/components/bailleur/accommodation-selector'
import { BailleurPermissionsFields } from '~/components/bailleur/users/bailleur-permissions-fields'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { ZBailleurAccommodationScope } from '~/schemas/bailleur-users/accommodation-scope'
import {
  BAILLEUR_PERMISSIONS,
  BAILLEUR_ROLES,
  type BailleurRole,
  defaultGestionnairePermissions,
  hasUsableGestionnairePermissions,
  MAX_BAILLEUR_ADMINISTRATORS,
} from '~/server/bailleur/permissions'

const formSchema = z
  .object({
    email: z.string().email('bailleur.users.form.errors.emailInvalid'),
    firstname: z.string().min(1, 'bailleur.users.form.errors.firstnameRequired'),
    lastname: z.string().min(1, 'bailleur.users.form.errors.lastnameRequired'),
    bailleurRole: z.enum(BAILLEUR_ROLES),
    bailleurPermissions: z.array(z.enum(BAILLEUR_PERMISSIONS)),
    applicationScope: ZBailleurAccommodationScope,
  })
  // Un gestionnaire sans autorisation ne peut ouvrir aucun ecran : on refuse la selection vide.
  .refine((values) => values.bailleurRole !== 'gestionnaire' || hasUsableGestionnairePermissions(values.bailleurPermissions), {
    path: ['bailleurPermissions'],
    message: 'bailleur.users.form.errors.permissionsRequired',
  })

export type BailleurUserFormData = z.infer<typeof formSchema>

type Props = {
  ownerId: number
  formId: string
  defaultValues?: Partial<BailleurUserFormData>
  onSubmit: (data: BailleurUserFormData) => void
  canGrantAdministratorRights?: boolean
  ownerContactMode: EOwnerContactMode
  administratorLimitReached?: boolean
  initialScopeSelection?: Array<{ id: number; name: string }>
}

export const BailleurUserForm = ({
  ownerId,
  formId,
  defaultValues,
  onSubmit,
  canGrantAdministratorRights = true,
  administratorLimitReached = false,
  ownerContactMode,
  initialScopeSelection,
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
      bailleurPermissions: defaultGestionnairePermissions(ownerContactMode),
      applicationScope: { mode: 'all' },
      ...defaultValues,
    },
  })

  const bailleurRole = watch('bailleurRole')
  const selectedPermissions = watch('bailleurPermissions')
  const applicationScope = watch('applicationScope')

  const selectRole = (role: BailleurRole, onRoleChange: (role: BailleurRole) => void) => {
    onRoleChange(role)
    if (role === 'administrator') setValue('applicationScope', { mode: 'all' })
    if (role === 'gestionnaire' && (selectedPermissions ?? []).length === 0) {
      setValue('bailleurPermissions', defaultGestionnairePermissions(ownerContactMode), { shouldValidate: true })
    }
  }

  const translateError = (key?: string) => (key ? t(key.replace('bailleur.users.', '') as Parameters<typeof t>[0]) : undefined)

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)}>
      <div className="fr-grid-row fr-grid-row--gutters">
        <div className="fr-col-12 fr-col-md-6">
          <Input
            label={t('form.firstname')}
            nativeInputProps={register('firstname')}
            state={errors.firstname ? 'error' : 'default'}
            stateRelatedMessage={translateError(errors.firstname?.message)}
          />
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <Input
            label={t('form.lastname')}
            nativeInputProps={register('lastname')}
            state={errors.lastname ? 'error' : 'default'}
            stateRelatedMessage={translateError(errors.lastname?.message)}
          />
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <Input
            label={t('form.email')}
            nativeInputProps={{ type: 'email', ...register('email') }}
            state={errors.email ? 'error' : 'default'}
            stateRelatedMessage={translateError(errors.email?.message)}
          />
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <Controller
            control={control}
            name="bailleurRole"
            render={({ field }) => (
              <Select
                label={t('form.bailleurRole')}
                hint={administratorLimitReached ? t('adminLimit.hint', { max: MAX_BAILLEUR_ADMINISTRATORS }) : undefined}
                options={BAILLEUR_ROLES.filter((role) => canGrantAdministratorRights || role !== 'administrator').map((role) => ({
                  value: role,
                  label: t(`role.${role}`),
                }))}
                nativeSelectProps={{
                  value: field.value,
                  onChange: (e) => selectRole(e.target.value as BailleurRole, field.onChange),
                }}
              />
            )}
          />
        </div>
      </div>

      <BailleurPermissionsFields
        variant="chips"
        bailleurRole={bailleurRole}
        ownerContactMode={ownerContactMode}
        selectedPermissions={selectedPermissions ?? []}
        onChange={(permissions) => setValue('bailleurPermissions', permissions, { shouldValidate: true })}
        errorMessage={translateError(errors.bailleurPermissions?.message)}
      />

      {bailleurRole === 'gestionnaire' && (selectedPermissions ?? []).includes('manage_applications') && (
        <AccommodationSelector
          ownerId={ownerId}
          namespace="bailleur.users.scope"
          value={applicationScope ?? { mode: 'all' }}
          onChange={(scope) => setValue('applicationScope', scope, { shouldValidate: true })}
          initialSelection={initialScopeSelection}
        />
      )}
    </form>
  )
}
