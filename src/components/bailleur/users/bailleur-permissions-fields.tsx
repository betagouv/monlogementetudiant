'use client'

import Checkbox from '@codegouvfr/react-dsfr/Checkbox'
import { useTranslations } from 'next-intl'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import {
  BAILLEUR_PERMISSIONS,
  type BailleurPermission,
  type BailleurRole,
  canGrantApplicationsPermission,
} from '~/server/bailleur/permissions'

type Props = {
  /** Role selectionne dans le formulaire : un administrateur a toutes les autorisations d'office. */
  bailleurRole: BailleurRole | null | undefined
  /** Parcours de candidature du bailleur : sans parcours, « Gestion des candidats » n'ouvre aucun ecran. */
  ownerContactMode: EOwnerContactMode
  selectedPermissions: BailleurPermission[]
  onChange: (permissions: BailleurPermission[]) => void
  errorMessage?: string
}

/**
 * Bloc d'autorisations partage par le formulaire bailleur et le back-office admin.
 * Les autorisations par defaut sont posees par les formulaires appelants (valeurs initiales et
 * bascule de role) : ce composant ne fait qu'afficher la selection courante.
 */
export const BailleurPermissionsFields = ({ bailleurRole, ownerContactMode, selectedPermissions, onChange, errorMessage }: Props) => {
  const t = useTranslations('bailleur.users')
  const isAdministrator = bailleurRole === 'administrator'
  const canGrantApplications = canGrantApplicationsPermission(ownerContactMode)

  const togglePermission = (permission: BailleurPermission, checked: boolean) => {
    onChange(checked ? [...selectedPermissions, permission] : selectedPermissions.filter((p) => p !== permission))
  }

  return (
    <Checkbox
      legend={t('form.permissions')}
      hintText={isAdministrator ? t('form.administratorHint') : t('form.gestionnaireHint')}
      state={errorMessage ? 'error' : 'default'}
      stateRelatedMessage={errorMessage}
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
            checked: isAdministrator ? true : selectedPermissions.includes(permission),
            disabled: isAdministrator || blockedByContactMode,
            onChange: (e) => togglePermission(permission, e.target.checked),
          },
        }
      })}
    />
  )
}
