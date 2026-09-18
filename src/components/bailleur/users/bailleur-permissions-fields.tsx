'use client'

import Checkbox from '@codegouvfr/react-dsfr/Checkbox'
import Tag from '@codegouvfr/react-dsfr/Tag'
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
  variant?: 'checkbox' | 'chips'
}

export const BailleurPermissionsFields = ({
  bailleurRole,
  ownerContactMode,
  selectedPermissions,
  onChange,
  errorMessage,
  variant = 'checkbox',
}: Props) => {
  const t = useTranslations('bailleur.users')
  const isAdministrator = bailleurRole === 'administrator'
  const canGrantApplications = canGrantApplicationsPermission(ownerContactMode)

  const togglePermission = (permission: BailleurPermission, checked: boolean) => {
    onChange(checked ? [...selectedPermissions, permission] : selectedPermissions.filter((p) => p !== permission))
  }

  const options = BAILLEUR_PERMISSIONS.map((permission) => {
    const blockedByContactMode = permission === 'manage_applications' && !canGrantApplications
    return {
      permission,
      label: t(`permission.${permission}`),
      checked: isAdministrator ? true : selectedPermissions.includes(permission),
      disabled: isAdministrator || blockedByContactMode,
      hint:
        permission === 'manage_applications'
          ? blockedByContactMode
            ? t('permission.applicationsRequiresContactMode')
            : t('permission.applicationsRgpdHint')
          : undefined,
    }
  })

  const legendHint = isAdministrator ? t('form.administratorHint') : t('form.gestionnaireHint')

  if (variant === 'chips') {
    return (
      <fieldset className="fr-fieldset fr-mt-2w fr-mb-0">
        <legend className="fr-fieldset__legend fr-text--regular fr-pb-0">
          {t('form.permissions')}
          <span className="fr-hint-text">{legendHint}</span>
        </legend>
        <div className="fr-fieldset__element fr-mb-0">
          <div className="fr-flex fr-flex-wrap fr-flex-gap-2v fr-mt-2v">
            {options.map((option) => (
              <Tag
                key={option.permission}
                small
                pressed={option.checked}
                title={option.disabled ? (option.hint ?? legendHint) : option.hint}
                nativeButtonProps={{
                  type: 'button',
                  disabled: option.disabled,
                  onClick: () => togglePermission(option.permission, !option.checked),
                }}
              >
                {option.label}
              </Tag>
            ))}
          </div>
          {errorMessage && (
            <p className="fr-error-text fr-mt-1w" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      </fieldset>
    )
  }

  return (
    <Checkbox
      legend={t('form.permissions')}
      hintText={legendHint}
      state={errorMessage ? 'error' : 'default'}
      stateRelatedMessage={errorMessage}
      options={options.map((option) => ({
        label: option.label,
        hintText: option.hint,
        nativeInputProps: {
          value: option.permission,
          checked: option.checked,
          disabled: option.disabled,
          onChange: (e) => togglePermission(option.permission, e.target.checked),
        },
      }))}
    />
  )
}
