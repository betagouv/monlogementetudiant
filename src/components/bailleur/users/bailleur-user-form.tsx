'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import Input from '@codegouvfr/react-dsfr/Input'
import RadioButtons from '@codegouvfr/react-dsfr/RadioButtons'
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
  MAX_BAILLEUR_ADMINISTRATORS,
} from '~/server/bailleur/permissions'

const formSchema = z
  .object({
    email: z.string().email('bailleur.users.form.errors.emailInvalid'),
    firstname: z.string().min(1, 'bailleur.users.form.errors.firstnameRequired'),
    lastname: z.string().min(1, 'bailleur.users.form.errors.lastnameRequired'),
    bailleurRole: z.enum(BAILLEUR_ROLES),
    bailleurPermissions: z.array(z.enum(BAILLEUR_PERMISSIONS)),
  })
  // Un gestionnaire sans autorisation ne peut ouvrir aucun ecran : on refuse la selection vide.
  .refine((values) => values.bailleurRole !== 'gestionnaire' || hasUsableGestionnairePermissions(values.bailleurPermissions), {
    path: ['bailleurPermissions'],
    message: 'bailleur.users.form.errors.permissionsRequired',
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
      // Un gestionnaire sans autorisation n'ouvre aucun ecran : on part des autorisations par defaut.
      // L'edition d'un compte existant repasse ses propres valeurs juste apres.
      bailleurPermissions: defaultGestionnairePermissions(ownerContactMode),
      ...defaultValues,
    },
  })

  const bailleurRole = watch('bailleurRole')
  const selectedPermissions = watch('bailleurPermissions')

  // Un administrateur a toutes les autorisations : en repassant gestionnaire, la selection
  // affichee redeviendrait vide. On repropose les autorisations par defaut.
  const selectRole = (role: BailleurRole, onRoleChange: (role: BailleurRole) => void) => {
    onRoleChange(role)
    if (role === 'gestionnaire' && (selectedPermissions ?? []).length === 0) {
      setValue('bailleurPermissions', defaultGestionnairePermissions(ownerContactMode), { shouldValidate: true })
    }
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
                onChange: () => selectRole(role, field.onChange),
              },
            }))}
          />
        )}
      />

      <BailleurPermissionsFields
        bailleurRole={bailleurRole}
        ownerContactMode={ownerContactMode}
        selectedPermissions={selectedPermissions ?? []}
        onChange={(permissions) => setValue('bailleurPermissions', permissions, { shouldValidate: true })}
        errorMessage={translateError(errors.bailleurPermissions?.message)}
      />

      <div className="fr-mt-2w">
        <Button type="submit" disabled={isPending}>
          {isPending ? t('saving') : (submitLabel ?? t('submitUpdate'))}
        </Button>
      </div>
    </form>
  )
}
