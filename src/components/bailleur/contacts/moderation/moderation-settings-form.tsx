'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { BailleurUserModal, bailleurUserModal, type EditableBailleurUser } from '~/components/bailleur/users/bailleur-user-modal'
import type { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { useSetApplicationsPermission } from '~/hooks/use-set-applications-permission'
import type { BailleurPermission, BailleurRole } from '~/server/bailleur/permissions'
import { useTRPC } from '~/server/trpc/client'
import { buildHref } from '~/utils/preserve-query-params'
import { ModerationManagerCard } from './moderation-manager-card'
import styles from './moderation-settings-form.module.css'

type ManagerItem = {
  id: string
  email: string
  firstname: string
  lastname: string
  bailleurRole: BailleurRole | null
  bailleurPermissions: BailleurPermission[]
  applicationScopeCount: number | null
}

const managerName = (u: ManagerItem) => `${u.firstname} ${u.lastname}`.trim() || u.email

type Props = {
  ownerId: number
  ownerContactMode: EOwnerContactMode
  canGrantAdministratorRights: boolean
}

export const ModerationSettingsForm = ({ ownerId, ownerContactMode, canGrantAdministratorRights }: Props) => {
  const t = useTranslations('bailleur.contacts.moderation')
  const trpc = useTRPC()
  const searchParams = useSearchParams()
  const { mutate, isPending, variables } = useSetApplicationsPermission(ownerId)
  const [editedUser, setEditedUser] = useState<EditableBailleurUser | null>(null)

  const openModal = (manager: EditableBailleurUser) => {
    setEditedUser(manager)
    bailleurUserModal.open()
  }

  const { data } = useQuery(trpc.bailleur.users.list.queryOptions({ ownerId }))

  const items = (data?.items ?? []) as ManagerItem[]
  const gestionnaires = useMemo(() => items.filter((u) => u.bailleurRole === 'gestionnaire'), [items])
  const administratorCount = items.filter((u) => u.bailleurRole === 'administrator').length

  if (gestionnaires.length === 0) {
    return (
      <>
        <p className="fr-text-mention--grey">{t('empty')}</p>
        <Button linkProps={{ href: buildHref('/bailleur/utilisateurs', searchParams) }} iconId="ri-add-line">
          {t('addUser')}
        </Button>
      </>
    )
  }

  const savingUserId = isPending ? variables?.managers[0]?.userId : undefined

  return (
    <fieldset className={styles.fieldset}>
      <legend className="fr-sr-only">{t('legend')}</legend>
      <div className={styles.grid}>
        {gestionnaires.map((u) => {
          const lockedAsOnlyPermission = u.bailleurPermissions.length === 1 && u.bailleurPermissions[0] === 'manage_applications'

          return (
            <ModerationManagerCard
              key={u.id}
              userId={u.id}
              name={managerName(u)}
              checked={u.bailleurPermissions.includes('manage_applications')}
              onChange={(enabled) => mutate({ ownerId, managers: [{ userId: u.id, enabled }] })}
              lockedAsOnlyPermission={lockedAsOnlyPermission}
              disabled={savingUserId === u.id}
              applicationScopeCount={u.applicationScopeCount}
              onEdit={() => openModal(u)}
            />
          )
        })}
      </div>

      <BailleurUserModal
        ownerId={ownerId}
        ownerContactMode={ownerContactMode}
        canGrantAdministratorRights={canGrantAdministratorRights}
        user={editedUser}
        administratorCount={administratorCount}
      />
    </fieldset>
  )
}
