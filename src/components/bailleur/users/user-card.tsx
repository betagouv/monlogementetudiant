'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import Tag from '@codegouvfr/react-dsfr/Tag'
import { useTranslations } from 'next-intl'
import { useDeleteBailleurUser } from '~/hooks/use-bailleur-users'
import type { BailleurPermission, BailleurRole } from '~/server/bailleur/permissions'
import styles from './user-card.module.css'

type UserItem = {
  id: string
  firstname: string
  lastname: string
  email: string
  bailleurRole: BailleurRole | null
  bailleurPermissions: BailleurPermission[]
  applicationScopeCount?: number | null
}

type Props = {
  user: UserItem
  canEdit: boolean
  canDelete: boolean
  ownerId?: number
  onEdit: (user: UserItem) => void
}

const scopeSummary = (t: ReturnType<typeof useTranslations<'bailleur.users'>>, count: number | null | undefined) => {
  if (count === null || count === undefined) return t('scope.summaryAll')
  return count === 0 ? t('scope.summaryNone') : t('scope.summaryCount', { count })
}

export const UserCard = ({ user, canEdit, canDelete, ownerId, onEdit }: Props) => {
  const deleteUser = useDeleteBailleurUser()
  const t = useTranslations('bailleur.users')

  const modal = createModal({
    id: `delete-bailleur-user-${user.id}`,
    isOpenedByDefault: false,
  })

  const role = user.bailleurRole ?? 'gestionnaire'
  const isAdministrator = role === 'administrator'

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <Badge severity={role === 'administrator' ? 'info' : 'new'} noIcon small>
          {t(`role.${role}`)}
        </Badge>
        <div className={styles.actions}>
          {canEdit && <Button priority="tertiary" size="small" iconId="fr-icon-edit-line" title={t('edit')} onClick={() => onEdit(user)} />}
          {canDelete && (
            <Button priority="tertiary" size="small" iconId="fr-icon-delete-line" title={t('delete')} onClick={() => modal.open()} />
          )}
        </div>
      </div>

      <p className={styles.name}>
        {user.firstname} {user.lastname}
      </p>
      <p className={styles.email}>{user.email}</p>

      <div className={styles.permissions}>
        {isAdministrator ? (
          <Tag small>{t('permission.allAsAdministrator')}</Tag>
        ) : user.bailleurPermissions.length === 0 ? (
          <span className="fr-text-mention--grey fr-text--xs">{t('noPermissions')}</span>
        ) : (
          user.bailleurPermissions.map((p) => (
            <Tag key={p} small>
              {t(`permission.${p}`)}
            </Tag>
          ))
        )}
        {!isAdministrator && user.bailleurPermissions.includes('manage_applications') && (
          <Tag small>{scopeSummary(t, user.applicationScopeCount)}</Tag>
        )}
      </div>

      <modal.Component
        title={t('deleteModalTitle')}
        buttons={[
          { children: t('cancel'), doClosesModal: true },
          {
            children: t('delete'),
            onClick: () => deleteUser.mutate({ id: user.id, ownerId }),
            doClosesModal: true,
          },
        ]}
      >
        {t('deleteConfirm', { firstname: user.firstname, lastname: user.lastname })}
      </modal.Component>
    </div>
  )
}
