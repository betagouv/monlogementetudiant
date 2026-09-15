'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import SearchBar from '@codegouvfr/react-dsfr/SearchBar'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryStates } from 'nuqs'
import { useState } from 'react'
import { useDebounce } from 'use-debounce'
import { BailleurUserModal, bailleurUserModal, type EditableBailleurUser } from '~/components/bailleur/users/bailleur-user-modal'
import { UserCard } from '~/components/bailleur/users/user-card'
import type { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { useBailleurUsers } from '~/hooks/use-bailleur-users'
import styles from './users-list.module.css'

type Props = {
  currentUserId: string
  currentUserIsAdministrator: boolean
  ownerId: number
  ownerContactMode: EOwnerContactMode
  canGrantAdministratorRights: boolean
}

export function UsersList({ currentUserId, currentUserIsAdministrator, ownerId, ownerContactMode, canGrantAdministratorRights }: Props) {
  const t = useTranslations('bailleur.users')

  const [editedUser, setEditedUser] = useState<EditableBailleurUser | null>(null)
  const [{ recherche }, setQueryStates] = useQueryStates({
    recherche: parseAsString.withDefault(''),
  })
  const [debouncedSearch] = useDebounce(recherche, 300)

  const { data, isLoading } = useBailleurUsers({
    search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
    ownerId,
  })

  const items = (data?.items ?? []) as EditableBailleurUser[]
  const administratorCount = items.filter((u) => u.bailleurRole === 'administrator').length

  const openModal = (user: EditableBailleurUser | null) => {
    setEditedUser(user)
    bailleurUserModal.open()
  }

  return (
    <div className="fr-background-default--grey fr-p-4w">
      <div className="fr-flex fr-justify-content-space-between fr-align-items-end fr-mb-3w">
        <p className="fr-h3 fr-mb-0">
          <strong>{t(items.length === 1 ? 'countOne' : 'countOther', { count: items.length })}</strong>
        </p>
        <div className="fr-flex fr-flex-gap-4v">
          <Button priority="secondary" onClick={() => openModal(null)}>
            {t('addUser')}
          </Button>
          <SearchBar
            label={t('searchPlaceholder')}
            renderInput={({ className, id, type, placeholder }) => (
              <input
                className={className}
                id={id}
                type={type}
                placeholder={placeholder}
                value={recherche}
                onChange={(e) => setQueryStates({ recherche: e.target.value })}
              />
            )}
          />
        </div>
      </div>

      {isLoading ? (
        <p>{t('loading')}</p>
      ) : items.length === 0 ? (
        <p className="fr-text-mention--grey">{t('noUsers')}</p>
      ) : (
        <div className={styles.grid}>
          {items.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              canEdit={u.id !== currentUserId || currentUserIsAdministrator}
              canDelete={u.id !== currentUserId}
              ownerId={ownerId}
              onEdit={openModal}
            />
          ))}
        </div>
      )}

      <BailleurUserModal
        ownerId={ownerId}
        ownerContactMode={ownerContactMode}
        canGrantAdministratorRights={canGrantAdministratorRights}
        user={editedUser}
        administratorCount={administratorCount}
      />
    </div>
  )
}
