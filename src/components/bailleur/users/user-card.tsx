'use client'

import Badge from '@codegouvfr/react-dsfr/Badge'
import Button from '@codegouvfr/react-dsfr/Button'
import { createModal } from '@codegouvfr/react-dsfr/Modal'
import Tag from '@codegouvfr/react-dsfr/Tag'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useDeleteBailleurUser } from '~/hooks/use-bailleur-users'
import { BAILLEUR_PERMISSIONS, type BailleurPermission, type BailleurRole } from '~/server/bailleur/permissions'
import { buildHref } from '~/utils/preserve-query-params'
import styles from './user-card.module.css'

type UserItem = {
  id: string
  firstname: string
  lastname: string
  email: string
  bailleurRole: BailleurRole | null
  bailleurPermissions: BailleurPermission[]
}

type Props = {
  user: UserItem
  canDelete: boolean
}

export const UserCard = ({ user, canDelete }: Props) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deleteUser = useDeleteBailleurUser()
  const t = useTranslations('bailleur.users')

  const modal = createModal({
    id: `delete-bailleur-user-${user.id}`,
    isOpenedByDefault: false,
  })

  const role = user.bailleurRole ?? 'gestionnaire'
  const displayedPermissions = role === 'administrator' ? [...BAILLEUR_PERMISSIONS] : user.bailleurPermissions

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <Badge severity={role === 'administrator' ? 'info' : 'new'} noIcon small>
          {t(`role.${role}`)}
        </Badge>
        <div className={styles.actions}>
          <Button
            priority="tertiary no outline"
            size="small"
            iconId="fr-icon-edit-line"
            title={t('edit')}
            onClick={() => router.push(buildHref(`/bailleur/utilisateurs/${user.id}`, searchParams))}
          />
          {canDelete && (
            <Button
              priority="tertiary no outline"
              size="small"
              iconId="fr-icon-delete-line"
              title={t('delete')}
              onClick={() => modal.open()}
            />
          )}
        </div>
      </div>

      <p className={styles.name}>
        {user.firstname} {user.lastname}
      </p>
      <p className={styles.email}>{user.email}</p>

      <div className={styles.permissions}>
        {displayedPermissions.length === 0 ? (
          <span className="fr-text-mention--grey fr-text--xs">{t('noPermissions')}</span>
        ) : (
          displayedPermissions.map((p) => (
            <Tag key={p} small>
              {t(`permission.${p}`)}
            </Tag>
          ))
        )}
      </div>

      <modal.Component
        title={t('deleteModalTitle')}
        buttons={[
          { children: t('cancel'), doClosesModal: true },
          {
            children: t('delete'),
            onClick: () => deleteUser.mutate({ id: user.id }),
            doClosesModal: true,
          },
        ]}
      >
        {t('deleteConfirm', { firstname: user.firstname, lastname: user.lastname })}
      </modal.Component>
    </div>
  )
}
