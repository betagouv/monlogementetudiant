'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import { useTranslations } from 'next-intl'
import { ToggleSwitch } from '~/components/ui/toggle-switch'

type Props = {
  userId: string
  name: string
  checked: boolean
  onChange: (checked: boolean) => void

  lockedAsOnlyPermission: boolean
  disabled: boolean
  /** `null` = toutes les résidences. */
  applicationScopeCount: number | null
  /** Ouvre la fiche du compte, d'où le périmètre se modifie. */
  onEdit: () => void
}

export const ModerationManagerCard = ({
  userId,
  name,
  checked,
  onChange,
  lockedAsOnlyPermission,
  disabled,
  applicationScopeCount,
  onEdit,
}: Props) => {
  const t = useTranslations('bailleur.contacts.moderation')
  const tUsers = useTranslations('bailleur.users')

  return (
    <div className="fr-background-default--grey fr-border fr-border-radius--4 fr-p-2w fr-flex fr-direction-column fr-flex-gap-2v">
      <div className="fr-flex fr-justify-content-space-between fr-align-items-start">
        <Badge severity="new" noIcon small>
          {tUsers('role.gestionnaire')}
        </Badge>
        <Button priority="tertiary no outline" size="small" iconId="fr-icon-edit-line" title={tUsers('edit')} onClick={onEdit} />
      </div>
      <p className="fr-text--lg fr-text--bold fr-mt-1v fr-mb-0">{name}</p>
      <p className="fr-text--xs fr-text-mention--grey fr-mb-0">
        {applicationScopeCount === null
          ? tUsers('scope.summaryAll')
          : applicationScopeCount === 0
            ? tUsers('scope.summaryNone')
            : tUsers('scope.summaryCount', { count: applicationScopeCount })}
      </p>
      {/* `hr` porte déjà son filet en `background-image` chez DSFR : `fr-p-0` le réduit à 1px. */}
      <hr className="fr-p-0 fr-mt-1w fr-mb-3v" />
      <ToggleSwitch
        label={t('toggleLabel')}
        labelPosition="right"
        showCheckedHint={false}
        inputTitle={`moderation-${userId}`}
        checked={checked}
        onChange={onChange}
        disabled={disabled || lockedAsOnlyPermission}
        description={lockedAsOnlyPermission ? t('onlyPermissionHint') : t('toggleDescription', { name })}
        showDescription={lockedAsOnlyPermission}
      />
    </div>
  )
}
